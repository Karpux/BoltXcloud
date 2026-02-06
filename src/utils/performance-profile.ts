import { BX_FLAGS } from "@/utils/bx-flags";
import { BxEventBus } from "@/utils/bx-event-bus";
import { BxLogger } from "@/utils/bx-logger";
import { STATES } from "@/utils/global";
import { getGlobalPref, setGlobalPref, setStreamPref } from "@/utils/pref-utils";
import { StreamStatsCollector } from "@/utils/stream-stats-collector";
import { GlobalPref, StreamPref } from "@/enums/pref-keys";
import { StreamResolution, StreamStat, StreamVideoProcessing, StreamVideoProcessingMode, UiLayout, VideoPowerPreference } from "@/enums/pref-values";

export type PerformanceProfile = 'auto' | 'tv' | 'pc' | 'android';

const PROFILE_INTERVAL_MS = 15 * 1000;
const PROFILE_STABLE_COUNT = 3;
const PROFILE_COOLDOWN_MS = 90 * 1000;

function getDeviceProfile(): PerformanceProfile {
    const deviceType = BX_FLAGS.DeviceInfo.deviceType;
    if (deviceType === 'android-tv' || deviceType === 'webos' || STATES.userAgent.isTv) {
        return 'tv';
    }

    if (deviceType === 'android' || deviceType === 'android-handheld') {
        return 'android';
    }

    return 'pc';
}

function getProfileFromStats(statsCollector: StreamStatsCollector): PerformanceProfile | null {
    const playtime = statsCollector.getStat(StreamStat.PLAYTIME);
    if (playtime.seconds < 45) {
        return null;
    }

    const fps = statsCollector.getStat(StreamStat.FPS).current;
    const decode = statsCollector.getStat(StreamStat.DECODE_TIME).current;
    const jitter = statsCollector.getStat(StreamStat.JITTER).current;
    const bitrate = statsCollector.getStat(StreamStat.BITRATE).current;
    const packets = statsCollector.getStat(StreamStat.PACKETS_LOST);
    const packetLossRatio = packets.received > 0 ? packets.dropped / packets.received : 0;

    if (fps <= 0 && bitrate <= 0) {
        return null;
    }

    if (fps < 26 || decode > 28 || packetLossRatio > 0.02 || jitter > 25 || bitrate < 2) {
        return 'tv';
    }

    if (fps < 45 || decode > 20 || packetLossRatio > 0.01 || jitter > 18 || bitrate < 4) {
        return 'android';
    }

    return 'pc';
}

function clampProfile(base: PerformanceProfile, target: PerformanceProfile): PerformanceProfile {
    if (base === 'tv') {
        return 'tv';
    }

    if (base === 'android' && target === 'pc') {
        return 'android';
    }

    return target;
}

export function applyPerformanceProfile(profile: PerformanceProfile, origin: 'direct' | 'ui' = 'ui'): PerformanceProfile {
    const resolved = profile === 'auto' ? getDeviceProfile() : profile;

    if (resolved === 'tv') {
        setGlobalPref(GlobalPref.UI_LAYOUT, UiLayout.TV, origin);
        setGlobalPref(GlobalPref.UI_REDUCE_ANIMATIONS, true, origin);
        setGlobalPref(GlobalPref.UI_IMAGE_QUALITY, 50, origin);
        setGlobalPref(GlobalPref.STREAM_RESOLUTION, StreamResolution.DIM_720P, origin);
        setGlobalPref(GlobalPref.STREAM_MAX_VIDEO_BITRATE, 3 * 1024 * 1000, origin);
        setGlobalPref(GlobalPref.STREAM_COMBINE_SOURCES, true, origin);
        setGlobalPref(GlobalPref.UI_SKIP_SPLASH_VIDEO, true, origin);

        setStreamPref(StreamPref.VIDEO_MAX_FPS, 30, origin);
        setStreamPref(StreamPref.VIDEO_POWER_PREFERENCE, VideoPowerPreference.LOW_POWER, origin);
        setStreamPref(StreamPref.VIDEO_PROCESSING, StreamVideoProcessing.USM, origin);
        setStreamPref(StreamPref.VIDEO_PROCESSING_MODE, StreamVideoProcessingMode.PERFORMANCE, origin);
        setStreamPref(StreamPref.VIDEO_SHARPNESS, 0, origin);
        return resolved;
    }

    if (resolved === 'android') {
        setGlobalPref(GlobalPref.UI_LAYOUT, UiLayout.DEFAULT, origin);
        setGlobalPref(GlobalPref.UI_REDUCE_ANIMATIONS, true, origin);
        setGlobalPref(GlobalPref.UI_IMAGE_QUALITY, 70, origin);
        setGlobalPref(GlobalPref.STREAM_RESOLUTION, StreamResolution.DIM_720P, origin);
        setGlobalPref(GlobalPref.STREAM_MAX_VIDEO_BITRATE, 5 * 1024 * 1000, origin);
        setGlobalPref(GlobalPref.STREAM_COMBINE_SOURCES, true, origin);
        setGlobalPref(GlobalPref.UI_SKIP_SPLASH_VIDEO, true, origin);

        setStreamPref(StreamPref.VIDEO_MAX_FPS, 50, origin);
        setStreamPref(StreamPref.VIDEO_POWER_PREFERENCE, VideoPowerPreference.LOW_POWER, origin);
        setStreamPref(StreamPref.VIDEO_PROCESSING, StreamVideoProcessing.USM, origin);
        setStreamPref(StreamPref.VIDEO_PROCESSING_MODE, StreamVideoProcessingMode.PERFORMANCE, origin);
        setStreamPref(StreamPref.VIDEO_SHARPNESS, 0, origin);
        return resolved;
    }

    setGlobalPref(GlobalPref.UI_LAYOUT, UiLayout.DEFAULT, origin);
    setGlobalPref(GlobalPref.UI_REDUCE_ANIMATIONS, false, origin);
    setGlobalPref(GlobalPref.UI_IMAGE_QUALITY, 90, origin);
    setGlobalPref(GlobalPref.STREAM_RESOLUTION, 'auto', origin);
    setGlobalPref(GlobalPref.STREAM_MAX_VIDEO_BITRATE, 0, origin);
    setGlobalPref(GlobalPref.STREAM_COMBINE_SOURCES, false, origin);
    setGlobalPref(GlobalPref.UI_SKIP_SPLASH_VIDEO, false, origin);

    setStreamPref(StreamPref.VIDEO_MAX_FPS, 60, origin);
    setStreamPref(StreamPref.VIDEO_POWER_PREFERENCE, VideoPowerPreference.HIGH_PERFORMANCE, origin);
    setStreamPref(StreamPref.VIDEO_PROCESSING, StreamVideoProcessing.USM, origin);
    setStreamPref(StreamPref.VIDEO_PROCESSING_MODE, StreamVideoProcessingMode.QUALITY, origin);
    setStreamPref(StreamPref.VIDEO_SHARPNESS, 2, origin);

    return resolved;
}

export class PerformanceProfileManager {
    private static instance: PerformanceProfileManager;
    public static getInstance = () => PerformanceProfileManager.instance ?? (PerformanceProfileManager.instance = new PerformanceProfileManager());

    private intervalId?: number;
    private candidate: PerformanceProfile | null = null;
    private candidateCount = 0;
    private lastApplied: PerformanceProfile | null = null;
    private lastSwitchAt = 0;

    private constructor() {}

    start() {
        BxEventBus.Script.on('setting.changed', payload => {
            if (payload.settingKey === GlobalPref.PERFORMANCE_PROFILE) {
                this.onProfileChanged();
            }
        });

        BxEventBus.Stream.on('state.playing', () => {
            this.startMonitoring();
        });

        BxEventBus.Stream.on('state.stopped', () => {
            this.stopMonitoring();
        });

        this.onProfileChanged();
    }

    private onProfileChanged() {
        const profile = getGlobalPref(GlobalPref.PERFORMANCE_PROFILE) as PerformanceProfile;
        if (profile === 'auto') {
            this.lastApplied = applyPerformanceProfile('auto', 'ui');
            this.startMonitoring();
        } else {
            this.stopMonitoring();
        }
    }

    private startMonitoring() {
        if (this.intervalId || !STATES.isPlaying) {
            return;
        }

        if (getGlobalPref(GlobalPref.PERFORMANCE_PROFILE) !== 'auto') {
            return;
        }

        this.intervalId = window.setInterval(() => {
            void this.evaluateAutoProfile();
        }, PROFILE_INTERVAL_MS);
    }

    private stopMonitoring() {
        if (this.intervalId) {
            window.clearInterval(this.intervalId);
            this.intervalId = undefined;
        }

        this.candidate = null;
        this.candidateCount = 0;
    }

    private async evaluateAutoProfile() {
        if (getGlobalPref(GlobalPref.PERFORMANCE_PROFILE) !== 'auto' || !STATES.isPlaying) {
            this.stopMonitoring();
            return;
        }

        const statsCollector = StreamStatsCollector.getInstance();
        await statsCollector.collect();

        const base = getDeviceProfile();
        const statProfile = getProfileFromStats(statsCollector);
        if (!statProfile) {
            return;
        }

        const target = clampProfile(base, statProfile);
        if (this.lastApplied && target === this.lastApplied) {
            this.candidate = null;
            this.candidateCount = 0;
            return;
        }

        if (this.candidate !== target) {
            this.candidate = target;
            this.candidateCount = 1;
        } else {
            this.candidateCount += 1;
        }

        if (this.candidateCount < PROFILE_STABLE_COUNT) {
            return;
        }

        const now = Date.now();
        if (now - this.lastSwitchAt < PROFILE_COOLDOWN_MS) {
            return;
        }

        this.lastApplied = applyPerformanceProfile(target, 'ui');
        this.lastSwitchAt = now;
        this.candidate = null;
        this.candidateCount = 0;
        BxLogger.info('PerformanceProfile', 'auto-switched', this.lastApplied);
    }
}
