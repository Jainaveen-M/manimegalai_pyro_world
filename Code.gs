/**
 * Google Apps Script Web App for cracker/fireworks order booking.
 * Required Script Properties:
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_CHAT_ID
 *   ORDER_SECRET_KEY
 */

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      message: "Order API is live."
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doOptions(e) {
  return ContentService
    .createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    const props = PropertiesService.getScriptProperties();
    const telegramToken = props.getProperty("TELEGRAM_BOT_TOKEN") || "";
    const telegramChatId = props.getProperty("TELEGRAM_CHAT_ID") || "";
    const expectedSecret = props.getProperty("ORDER_SECRET_KEY") || "CrackerBazaar@2026!SecureOrder";

    let payload = {};
    try {
      payload = parseRequestBody(e);
    } catch (error) {
      return jsonResponse({
        ok: false,
        message: "Invalid JSON payload."
      }, 400);
    }

    const requestSecret =
      getHeaderValue(e, "x-order-secret") ||
      getHeaderValue(e, "X-Order-Secret") ||
      payload.secret ||
      payload.orderSecret ||
      "";

    if (!requestSecret || requestSecret !== expectedSecret) {
      return jsonResponse({
        ok: false,
        message: "Unauthorized request."
      }, 401);
    }

    const order = validateAndNormalizePayload(payload);
    const orderId = generateOrderId();
    const orderTimestamp = new Date().toISOString();
    const addressText = [order.address, order.city, order.pincode].filter(Boolean).join(", ").trim();
    const itemsBreakdown = order.items.map(item => {
      return `${item.name} x ${item.qty} @ ₹${Number(item.salePrice).toFixed(2)}`;
    }).join(" | ");
    const totalAmount = Number(order.totalAmount).toFixed(2);

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const headers = [
      "Timestamp",
      "Order ID",
      "Customer Name",
      "Phone",
      "Address/City/Pincode",
      "Items Breakdown",
      "Total Amount",
      "Status"
    ];

    const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    const hasHeader = firstRow.some(value => String(value).trim().length > 0);

    if (!hasHeader) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    sheet.appendRow([
      orderTimestamp,
      orderId,
      order.customerName,
      order.phone,
      addressText,
      itemsBreakdown,
      totalAmount,
      "New"
    ]);

    if (telegramToken && telegramChatId) {
      try {
        const telegramMessage = buildTelegramMessage({
          orderId,
          customerName: order.customerName,
          phone: order.phone,
          address: addressText,
          items: order.items,
          totalAmount
        });
        sendTelegramMessage(telegramToken, telegramChatId, telegramMessage);
      } catch (tgError) {
        console.error("Telegram notification error:", tgError);
      }
    }

    return jsonResponse({
      ok: true,
      orderId,
      totalAmount: Number(totalAmount),
      message: "Order placed successfully.",
      bankDetails: {
        bankName: "Bank of India",
        accountName: "Gobinath R",
        accountNumber: "815210110019916",
        ifsc: "BKID0008152",
        branch: "SIVAKASI",
        gpayPhonePe: "9524803201 (Gobinath R)"
      }
    }, 200);
  } catch (error) {
    console.error("doPost error:", error);
    return jsonResponse({
      ok: false,
      message: "Something went wrong while processing the order."
    }, 500);
  }
}

function parseRequestBody(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }

  const raw = e.postData.contents;
  if (!raw || !raw.trim()) {
    return {};
  }

  return JSON.parse(raw);
}

function getHeaderValue(e, key) {
  try {
    if (!e || !e.headers) return "";
    return e.headers[key] || e.headers[key.toLowerCase()] || "";
  } catch (err) {
    return "";
  }
}

function jsonResponse(data, statusCode) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function validateAndNormalizePayload(payload) {
  const customerName = String(payload.customerName || "").trim();
  const phone = String(payload.phone || "").trim();
  const address = String(payload.address || "").trim();
  const city = String(payload.city || "").trim();
  const pincode = String(payload.pincode || "").trim();
  const totalAmount = Number(payload.totalAmount || 0);
  let items = payload.items;
  if (typeof items === "string") {
    try { items = JSON.parse(items); } catch (err) { items = []; }
  }
  if (!Array.isArray(items)) {
    items = [];
  }

  if (!customerName || !phone || !address || !city || !pincode) {
    throw new Error("Customer details are incomplete.");
  }

  const validItems = items
    .map(item => {
      const name = String(item.name || "").trim();
      const qty = Number(item.qty || 0);
      const salePrice = Number(item.salePrice || 0);

      if (!name || qty <= 0 || salePrice <= 0) {
        return null;
      }

      return { name, qty, salePrice };
    })
    .filter(Boolean);

  if (!validItems.length) {
    throw new Error("Cart is empty.");
  }

  const computedTotal = validItems.reduce((sum, item) => sum + (item.qty * item.salePrice), 0);
  if (computedTotal <= 0 || Math.abs(computedTotal - totalAmount) > 0.01) {
    throw new Error("Total amount mismatch.");
  }

  return {
    customerName,
    phone,
    address,
    city,
    pincode,
    totalAmount,
    items: validItems
  };
}

function generateOrderId() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hr = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const sec = String(now.getSeconds()).padStart(2, "0");
  const randomSuffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `CRK-${y}${m}${d}-${hr}${min}${sec}-${randomSuffix}`;
}

function buildTelegramMessage({ orderId, customerName, phone, address, items, totalAmount }) {
  const lines = [
    "*New Firecracker Order*",
    "",
    `*Order ID:* ${escapeMarkdown(orderId)}`,
    `*Customer:* ${escapeMarkdown(customerName)}`,
    `*Phone:* ${escapeMarkdown(phone)}`,
    `*Address:* ${escapeMarkdown(address)}`,
    "",
    "*Items:*"
  ];

  items.forEach(item => {
    lines.push(`- ${escapeMarkdown(item.name)} x ${item.qty} @ ₹${Number(item.salePrice).toFixed(2)}`);
  });

  lines.push("", `*Total Amount:* ₹${Number(totalAmount).toFixed(2)}`);
  return lines.join("\n");
}

function sendTelegramMessage(botToken, chatId, text) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const response = UrlFetchApp.fetch(url, {
    method: "post",
    payload: {
      chat_id: chatId,
      text: text,
      parse_mode: "Markdown"
    },
    muteHttpExceptions: true
  });

  const result = JSON.parse(response.getContentText());
  return {
    ok: !!result.ok,
    data: result
  };
}

function escapeMarkdown(text) {
  return String(text).replace(/([_\*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
}
