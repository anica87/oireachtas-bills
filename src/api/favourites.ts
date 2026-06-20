const MOCK_LATENCY_MS = 400;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function favouriteBillRequest(billId: string): Promise<void> {
  console.log(`[favourites] Dispatching request to favourite bill ${billId}`);
  await delay(MOCK_LATENCY_MS);
  console.log(`[favourites] Server confirmed favourite for bill ${billId}`);
}

export async function unfavouriteBillRequest(billId: string): Promise<void> {
  console.log(`[favourites] Dispatching request to un-favourite bill ${billId}`);
  await delay(MOCK_LATENCY_MS);
  console.log(`[favourites] Server confirmed un-favourite for bill ${billId}`);
}
