// Fatigue model tuning constants. Documented as tunable.

export const RPE_REF = 8.0; // reference effort
export const RPE_GAIN = 0.12; // each RPE point above/below ref scales stimulus
export const BODYWEIGHT_FRACTION = 0.65; // load proxy for bodyweight exercises
export const MIN_INTENSITY = 0.3; // floor so very-easy sets still count a little

export const LOOKBACK_DAYS = 10; // ~3.5 half-lives; older sessions vanish
export const SORENESS_WEIGHT = 0.06; // per severity point (0..10) -> up to +0.6
export const SORENESS_HALFLIFE_HOURS = 24;
export const SORENESS_LOOKBACK_HOURS = 72;

export const FRESH_THRESHOLD = 0.25; // fatigue below this counts as "recovered"
