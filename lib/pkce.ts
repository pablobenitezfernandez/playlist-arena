function base64UrlEncode(input: ArrayBuffer): string {
  const bytes = new Uint8Array(input);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function createRandomString(length: number): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const randomValues = crypto.getRandomValues(new Uint8Array(length));
  let output = "";

  randomValues.forEach((value) => {
    output += alphabet[value % alphabet.length];
  });

  return output;
}

async function sha256(value: string): Promise<ArrayBuffer> {
  const encoded = new TextEncoder().encode(value);
  return crypto.subtle.digest("SHA-256", encoded);
}

export async function createPkceSession() {
  const verifier = createRandomString(96);
  const state = createRandomString(24);
  const challenge = base64UrlEncode(await sha256(verifier));

  return {
    verifier,
    state,
    challenge
  };
}
