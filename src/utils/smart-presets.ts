import { GlobalPref, StreamPref } from "@/enums/pref-keys";
import { StreamResolution, StreamVideoProcessing, StreamVideoProcessingMode } from "@/enums/pref-values";
import { getGlobalPref, setGlobalPref, setStreamPref } from "@/utils/pref-utils";

export type NetworkProfile = 'auto' | 'low' | 'balanced' | 'high';
export type VideoProfile = 'soft' | 'balanced' | 'sharp';
export type ControllerResponse = 'stable' | 'balanced' | 'fast';

export function applyNetworkProfile(profile: NetworkProfile) {
    if (profile === 'low') {
        setGlobalPref(GlobalPref.STREAM_RESOLUTION, StreamResolution.DIM_720P, 'ui');
        setGlobalPref(GlobalPref.STREAM_MAX_VIDEO_BITRATE, 3 * 1024 * 1000, 'ui');
        setGlobalPref(GlobalPref.STREAM_PREVENT_RESOLUTION_DROPS, true, 'ui');
        return;
    }

    if (profile === 'balanced') {
        setGlobalPref(GlobalPref.STREAM_RESOLUTION, StreamResolution.DIM_720P, 'ui');
        setGlobalPref(GlobalPref.STREAM_MAX_VIDEO_BITRATE, 6 * 1024 * 1000, 'ui');
        setGlobalPref(GlobalPref.STREAM_PREVENT_RESOLUTION_DROPS, true, 'ui');
        return;
    }

    if (profile === 'high') {
        setGlobalPref(GlobalPref.STREAM_RESOLUTION, 'auto', 'ui');
        setGlobalPref(GlobalPref.STREAM_MAX_VIDEO_BITRATE, 12 * 1024 * 1000, 'ui');
        setGlobalPref(GlobalPref.STREAM_PREVENT_RESOLUTION_DROPS, false, 'ui');
        return;
    }

    setGlobalPref(GlobalPref.STREAM_RESOLUTION, 'auto', 'ui');
    setGlobalPref(GlobalPref.STREAM_MAX_VIDEO_BITRATE, 0, 'ui');
    setGlobalPref(GlobalPref.STREAM_PREVENT_RESOLUTION_DROPS, false, 'ui');
}

export function applyVideoProfile(profile: VideoProfile) {
    if (profile === 'soft') {
        setStreamPref(StreamPref.VIDEO_PROCESSING, StreamVideoProcessing.USM, 'ui');
        setStreamPref(StreamPref.VIDEO_PROCESSING_MODE, StreamVideoProcessingMode.PERFORMANCE, 'ui');
        setStreamPref(StreamPref.VIDEO_SHARPNESS, 0, 'ui');
        return;
    }

    if (profile === 'sharp') {
        setStreamPref(StreamPref.VIDEO_PROCESSING, StreamVideoProcessing.USM, 'ui');
        setStreamPref(StreamPref.VIDEO_PROCESSING_MODE, StreamVideoProcessingMode.QUALITY, 'ui');
        setStreamPref(StreamPref.VIDEO_SHARPNESS, 2, 'ui');
        return;
    }

    setStreamPref(StreamPref.VIDEO_PROCESSING, StreamVideoProcessing.USM, 'ui');
    setStreamPref(StreamPref.VIDEO_PROCESSING_MODE, StreamVideoProcessingMode.PERFORMANCE, 'ui');
    setStreamPref(StreamPref.VIDEO_SHARPNESS, 1, 'ui');
}

export function applyControllerResponse(profile: ControllerResponse) {
    if (profile === 'stable') {
        setStreamPref(StreamPref.CONTROLLER_POLLING_RATE, 16, 'ui');
        return;
    }

    if (profile === 'fast') {
        setStreamPref(StreamPref.CONTROLLER_POLLING_RATE, 4, 'ui');
        return;
    }

    setStreamPref(StreamPref.CONTROLLER_POLLING_RATE, 8, 'ui');
}

export function applyCompactUi(enabled?: boolean) {
    const active = typeof enabled === 'boolean' ? enabled : !!getGlobalPref(GlobalPref.UI_COMPACT);
    document.documentElement.classList.toggle('bx-compact-ui', active);
}
