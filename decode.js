// How to run this file:
// node decode.js "PASTE_YOUR_ID_TOKEN_HERE"


// This function turns encoded text into normal readable JSON
function decodeBase64Url(text) {

  // JWT uses a slightly different Base64 format
  // I fix it so Node.js understands it
  const fixedBase64 =
    text
      .replace(/-/g, "+")     // JWT uses "-" instead of "+"
      .replace(/_/g, "/")     // JWT uses "_" instead of "/"
      + "=".repeat((4 - (text.length % 4)) % 4); // add padding if needed

  // Convert Base64 → normal text
  const readableText = Buffer
    .from(fixedBase64, "base64")
    .toString("utf8");

  // Turn text into a JavaScript object
  return JSON.parse(readableText);
}

// Get my token that I typed in the terminal
const token = process.argv[2];

// If no token was provided, tell me what to do
if (!token) {
  console.log('❌ Please run: node decode.js "PASTE_ID_TOKEN_HERE"');
  process.exit(1); // stop the program
}

// A JWT has 3 parts separated by dots:
// header.payload.signature
const parts = token.split(".");

// I should only care about the first two parts
const headerPart = parts[0];
const payloadPart = parts[1];


// Decode and print the HEADER
console.log("\n HEADER (how the token was signed):");
console.log(decodeBase64Url(headerPart));


// Decode and print the PAYLOAD
console.log("\n PAYLOAD (this is the user info):");
console.log(decodeBase64Url(payloadPart));
