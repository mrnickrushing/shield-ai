import * as SecureStore from "expo-secure-store";
import * as StoreReview from "expo-store-review";

const LAST_ASK_KEY = "shield.review.lastAskAt";
const WINS_KEY = "shield.review.wins";
const SEEN_KEYS_KEY = "shield.review.seenWinKeys";
// Apple allows at most 3 system prompts per 365 days; spacing asks ~4 months
// apart stays inside that budget without tracking the yearly count.
const MIN_DAYS_BETWEEN_ASKS = 122;
const MIN_WINS_BEFORE_ASK = 2;
const MAX_SEEN_KEYS = 12; // SecureStore values are size-capped

/**
 * Call at a "win" moment — the app just caught something for the user (a
 * high-risk verdict, a threat-filled weekly report). `winKey` identifies the
 * specific catch (scan id, report week) so re-viewing the same result never
 * counts twice. After enough distinct wins, and never more than once per ask
 * window, triggers the system rating prompt. Never call from the paywall or
 * app launch.
 */
export async function recordWinAndMaybeAskForReview(winKey: string): Promise<void> {
  try {
    const seenRaw = (await SecureStore.getItemAsync(SEEN_KEYS_KEY)) ?? "[]";
    let seen: string[] = [];
    try {
      seen = JSON.parse(seenRaw);
    } catch {
      seen = [];
    }
    if (seen.includes(winKey)) return;
    await SecureStore.setItemAsync(
      SEEN_KEYS_KEY,
      JSON.stringify([...seen, winKey].slice(-MAX_SEEN_KEYS))
    );

    const wins = parseInt((await SecureStore.getItemAsync(WINS_KEY)) ?? "0", 10) + 1;
    await SecureStore.setItemAsync(WINS_KEY, String(wins));
    if (wins < MIN_WINS_BEFORE_ASK) return;

    const lastAsk = parseInt((await SecureStore.getItemAsync(LAST_ASK_KEY)) ?? "0", 10);
    if (Date.now() - lastAsk < MIN_DAYS_BETWEEN_ASKS * 86_400_000) return;

    if (!(await StoreReview.hasAction())) return;

    await SecureStore.setItemAsync(LAST_ASK_KEY, String(Date.now()));
    await StoreReview.requestReview();
  } catch {
    // Best-effort: the rating prompt must never break a screen.
  }
}
