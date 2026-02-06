import { BypassServers } from "@/enums/bypass-servers";
import { GlobalPref, StorageKey } from "@/enums/pref-keys";
import { UserAgentProfile } from "@/enums/user-agent";
import { type SettingDefinition, type SettingDefinitions } from "@/types/setting-definition";
import { BX_FLAGS } from "../bx-flags";
import { STATES, AppInterface } from "../global";
import { CE } from "../html";
import { t, SUPPORTED_LANGUAGES } from "../translation";
import { UserAgent } from "../user-agent";
import { BaseSettingsStorage } from "./base-settings-storage";
import { CodecProfile, StreamResolution, TouchControllerMode, TouchControllerStyleStandard, TouchControllerStyleCustom, GameBarPosition, NativeMkbMode, UiLayout, UiSection, BlockFeature, UiTheme } from "@/enums/pref-values";
import { GhPagesUtils } from "../gh-pages";
import { BxEventBus } from "../bx-event-bus";

const isSmartTv = BX_FLAGS.DeviceInfo.deviceType === 'android-tv'
    || BX_FLAGS.DeviceInfo.deviceType === 'webos'
    || STATES.userAgent.isTv;
const isMobile = UserAgent.isMobile();
const defaultPerformanceProfile = 'auto';
const defaultNetworkProfile = isSmartTv ? 'low' : (isMobile ? 'balanced' : 'auto');
const defaultVideoProfile = isSmartTv ? 'soft' : 'balanced';
const defaultControllerResponse = isSmartTv ? 'stable' : 'balanced';
const defaultCompactUi = isSmartTv || isMobile;


function getSupportedCodecProfiles() {
    const options: PartialRecord<CodecProfile, string> = {
        default: t('default'),
    };

    if (!('getCapabilities' in RTCRtpReceiver)) {
        return options;
    }

    let hasLowCodec = false;
    let hasNormalCodec = false;
    let hasHighCodec = false;

    const codecs = RTCRtpReceiver.getCapabilities('video')!.codecs;
    for (let codec of codecs) {
        if (codec.mimeType.toLowerCase() !== 'video/h264' || !codec.sdpFmtpLine) {
            continue;
        }

        const fmtp = codec.sdpFmtpLine.toLowerCase();
        if (fmtp.includes('profile-level-id=4d')) {
            hasHighCodec = true;
        } else if (fmtp.includes('profile-level-id=42e')) {
            hasNormalCodec = true;
        } else if (fmtp.includes('profile-level-id=420')) {
            hasLowCodec = true;
        }
    }

    if (hasLowCodec) {
        if (!hasNormalCodec && !hasHighCodec) {
            options[CodecProfile.DEFAULT] = `${t('visual-quality-low')} (${t('default')})`;
        } else {
            options[CodecProfile.LOW] = t('visual-quality-low');
        }
    }

    if (hasNormalCodec) {
        if (!hasLowCodec && !hasHighCodec) {
            options[CodecProfile.DEFAULT] = `${t('visual-quality-normal')} (${t('default')})`;
        } else {
            options[CodecProfile.NORMAL] = t('visual-quality-normal');
        }
    }

    if (hasHighCodec) {
        if (!hasLowCodec && !hasNormalCodec) {
            options[CodecProfile.DEFAULT] = `${t('visual-quality-high')} (${t('default')})`;
        } else {
            options[CodecProfile.HIGH] = t('visual-quality-high');
        }
    }

    return options;
}

export class GlobalSettingsStorage extends BaseSettingsStorage<GlobalPref> {
    private static readonly DEFINITIONS: SettingDefinitions<GlobalPref> = {
        [GlobalPref.VERSION_LAST_CHECK]: {
            default: 0,
        },
        [GlobalPref.VERSION_LATEST]: {
            default: '',
        },
        [GlobalPref.VERSION_CURRENT]: {
            default: '',
        },
        [GlobalPref.SCRIPT_LOCALE]: {
            label: t('language'),
            default: localStorage.getItem(StorageKey.LOCALE) || 'en-US',
            options: SUPPORTED_LANGUAGES,
        },
        [GlobalPref.PERFORMANCE_PROFILE]: {
            label: t('performance-profile'),
            note: t('performance-profile-note'),
            default: defaultPerformanceProfile,
            options: {
                auto: t('auto'),
                tv: t('profile-tv'),
                pc: t('profile-pc'),
                android: t('profile-android'),
            },
        },
        [GlobalPref.NETWORK_PROFILE]: {
            label: t('network-profile'),
            note: t('network-profile-note'),
            default: defaultNetworkProfile,
            options: {
                auto: t('auto'),
                low: t('profile-low'),
                balanced: t('profile-balanced'),
                high: t('profile-high'),
            },
        },
        [GlobalPref.VIDEO_PROFILE]: {
            label: t('video-profile'),
            note: t('video-profile-note'),
            default: defaultVideoProfile,
            options: {
                soft: t('profile-soft'),
                balanced: t('profile-balanced'),
                sharp: t('profile-sharp'),
            },
        },
        [GlobalPref.CONTROLLER_RESPONSE]: {
            label: t('controller-response'),
            note: t('controller-response-note'),
            default: defaultControllerResponse,
            options: {
                stable: t('profile-stable'),
                balanced: t('profile-balanced'),
                fast: t('profile-fast'),
            },
        },
        [GlobalPref.UI_COMPACT]: {
            label: t('compact-ui'),
            note: t('compact-ui-note'),
            default: defaultCompactUi,
        },
        [GlobalPref.SERVER_REGION]: {
            label: t('region'),
            note: CE('a', { target: '_blank', href: 'https://umap.openstreetmap.fr/en/map/xbox-cloud-gaming-servers_1135022' }, t('server-locations')),
            default: 'default',
        },
        [GlobalPref.SERVER_BYPASS_RESTRICTION]: {
            label: t('bypass-region-restriction'),
            note: '⚠️ ' + t('use-this-at-your-own-risk'),
            default: 'off',
            optionsGroup: t('region'),
            options: Object.assign({
                'off': t('off'),
            }, BypassServers),
        },

        [GlobalPref.STREAM_PREFERRED_LOCALE]: {
            label: t('preferred-game-language'),
            default: 'default',
            options: {
                default: t('default'),
                'ar-SA': 'العربية',
                'bg-BG': 'Български',
                'cs-CZ': 'čeština',
                'da-DK': 'dansk',
                'de-DE': 'Deutsch',
                'el-GR': 'Ελληνικά',
                'en-GB': 'English (UK)',
                'en-US': 'English (US)',
                'es-ES': 'español (España)',
                'es-MX': 'español (Latinoamérica)',
                'fi-FI': 'suomi',
                'fr-FR': 'français',
                'he-IL': 'עברית',
                'hu-HU': 'magyar',
                'it-IT': 'italiano',
                'ja-JP': '日本語',
                'ko-KR': '한국어',
                'nb-NO': 'norsk bokmål',
                'nl-NL': 'Nederlands',
                'pl-PL': 'polski',
                'pt-BR': 'português (Brasil)',
                'pt-PT': 'português (Portugal)',
                'ro-RO': 'Română',
                'ru-RU': 'русский',
                'sk-SK': 'slovenčina',
                'sv-SE': 'svenska',
                'th-TH': 'ไทย',
                'tr-TR': 'Türkçe',
                'zh-CN': '中文(简体)',
                'zh-TW': '中文 (繁體)',
            },
        },
        [GlobalPref.STREAM_RESOLUTION]: {
            label: t('target-resolution'),
            default: isSmartTv ? StreamResolution.DIM_720P : 'auto',
            options: {
                auto: t('default'),
                [StreamResolution.DIM_720P]: '720p',
                [StreamResolution.DIM_1080P]: '1080p',
                [StreamResolution.DIM_1080P_HQ]: '1080p (HQ)',
            },
            suggest: {
                lowest: StreamResolution.DIM_720P,
                highest: StreamResolution.DIM_1080P_HQ,
            },
        },
        [GlobalPref.STREAM_PREVENT_RESOLUTION_DROPS]: {
            label: t('prevent-resolution-drops'),
            default: false,
            note: CE('a', { href: 'https://github.com/redphx/better-xcloud/issues/791', target: '_blank' }, '⚠️ ' + t('unexpected-behavior')),
        },

        [GlobalPref.STREAM_CODEC_PROFILE]: {
            label: t('visual-quality'),
            default: CodecProfile.DEFAULT,
            options: getSupportedCodecProfiles(),
            ready: (setting: SettingDefinition) => {
                const options = (setting as any).options;
                const keys = Object.keys(options);

                if (keys.length <= 1) { // Unsupported
                    setting.unsupported = true;
                    setting.unsupportedNote = '⚠️ ' + t('browser-unsupported-feature');
                }

                setting.suggest = {
                    lowest: keys.length === 1 ? keys[0] : keys[1],
                    highest: keys[keys.length - 1],
                };
            },
        },
        [GlobalPref.SERVER_PREFER_IPV6]: {
            label: t('prefer-ipv6-server'),
            default: false,
        },

        [GlobalPref.SCREENSHOT_APPLY_FILTERS]: {
            requiredVariants: 'full',
            label: t('screenshot-apply-filters'),
            default: false,
        },

        [GlobalPref.UI_SKIP_SPLASH_VIDEO]: {
            label: t('skip-splash-video'),
            default: isSmartTv,
        },
        [GlobalPref.UI_HIDE_SYSTEM_MENU_ICON]: {
            label: '⣿ ' + t('hide-system-menu-icon'),
            default: false,
        },
        [GlobalPref.UI_IMAGE_QUALITY]: {
            requiredVariants: 'full',
            label: t('image-quality'),
            default: isSmartTv ? 50 : 90,
            min: 10,
            max: 90,
            params: {
                steps: 10,
                exactTicks: 20,
                hideSlider: true,
                customTextValue(value, min, max) {
                    if (value === 90) {
                        return t('default');
                    }

                    return value + '%';
                },
            },
        },
        [GlobalPref.UI_THEME]: {
            label: t('theme'),
            default: UiTheme.DEFAULT,
            options: {
                [UiTheme.DEFAULT]: t('default'),
                [UiTheme.DARK_OLED]: t('oled'),
            },
        },

        [GlobalPref.STREAM_COMBINE_SOURCES]: {
            requiredVariants: 'full',

            label: t('combine-audio-video-streams'),
            default: isSmartTv,
            experimental: true,
            note: t('combine-audio-video-streams-summary'),
        },

        [GlobalPref.TOUCH_CONTROLLER_MODE]: {
            requiredVariants: 'full',
            label: t('availability'),
            default: TouchControllerMode.ALL,
            options: {
                [TouchControllerMode.DEFAULT]: t('default'),
                [TouchControllerMode.OFF]: t('off'),
                [TouchControllerMode.ALL]: t('all-games'),
            },

            unsupported: !STATES.userAgent.capabilities.touch,
            unsupportedValue: TouchControllerMode.DEFAULT,
        },
        [GlobalPref.TOUCH_CONTROLLER_AUTO_OFF]: {
            requiredVariants: 'full',
            label: t('tc-auto-off'),
            default: false,
            unsupported: !STATES.userAgent.capabilities.touch,
        },
        [GlobalPref.TOUCH_CONTROLLER_DEFAULT_OPACITY]: {
            requiredVariants: 'full',
            label: t('default-opacity'),
            default: 100,
            min: 10,
            max: 100,
            params: {
                steps: 10,
                suffix: '%',
                ticks: 10,
                hideSlider: true,
            },
            unsupported: !STATES.userAgent.capabilities.touch,
        },
        [GlobalPref.TOUCH_CONTROLLER_STYLE_STANDARD]: {
            requiredVariants: 'full',
            label: t('tc-standard-layout-style'),
            default: TouchControllerStyleStandard.DEFAULT,
            options: {
                [TouchControllerStyleStandard.DEFAULT]: t('default'),
                [TouchControllerStyleStandard.WHITE]: t('tc-all-white'),
                [TouchControllerStyleStandard.MUTED]: t('tc-muted-colors'),
            },
            unsupported: !STATES.userAgent.capabilities.touch,
        },
        [GlobalPref.TOUCH_CONTROLLER_STYLE_CUSTOM]: {
            requiredVariants: 'full',
            label: t('tc-custom-layout-style'),
            default: TouchControllerStyleCustom.DEFAULT,
            options: {
                [TouchControllerStyleCustom.DEFAULT]: t('default'),
                [TouchControllerStyleCustom.MUTED]: t('tc-muted-colors'),
            },
            unsupported: !STATES.userAgent.capabilities.touch,
        },

        [GlobalPref.UI_SIMPLIFY_STREAM_MENU]: {
            label: t('simplify-stream-menu'),
            default: false,
        },
        [GlobalPref.MKB_HIDE_IDLE_CURSOR]: {
            requiredVariants: 'full',
            label: t('hide-idle-cursor'),
            default: false,
        },
        [GlobalPref.UI_DISABLE_FEEDBACK_DIALOG]: {
            requiredVariants: 'full',
            label: t('disable-post-stream-feedback-dialog'),
            default: false,
        },

        [GlobalPref.STREAM_MAX_VIDEO_BITRATE]: {
            requiredVariants: 'full',
            label: t('bitrate-video-maximum'),
            note: '⚠️ ' + t('unexpected-behavior'),
            default: isSmartTv ? 3 * 1024 * 1000 : 0,
            min: 1024 * 100,
            max: 15 * 1024 * 1000,
            transformValue: {
                get(value) {
                    return value === 0 ? this.max : value;
                },

                set(value) {
                    return value === this.max ? 0 : value;
                },
            },
            params: {
                steps: 100 * 1024,
                exactTicks: 5 * 1024 * 1000,
                customTextValue: (value: any, min, max) => {
                    value = parseInt(value);

                    if (value === max) {
                        return t('unlimited');
                    } else {
                        return (value / (1024 * 1000)).toFixed(1) + ' Mb/s';
                    }
                },
            },
            suggest: {
                highest: 0,
            },
        },

        [GlobalPref.GAME_BAR_POSITION]: {
            requiredVariants: 'full',
            label: t('position'),
            default: GameBarPosition.BOTTOM_LEFT,
            options: {
                [GameBarPosition.OFF]: t('off'),
                [GameBarPosition.BOTTOM_LEFT]: t('bottom-left'),
                [GameBarPosition.BOTTOM_RIGHT]: t('bottom-right'),
            },
        },

        [GlobalPref.UI_CONTROLLER_SHOW_STATUS]: {
            label: t('show-controller-connection-status'),
            default: true,
        },

        [GlobalPref.MKB_ENABLED]: {
            requiredVariants: 'full',
            label: t('enable-mkb'),
            default: false,
            unsupported: !STATES.userAgent.capabilities.mkb || !STATES.browser.capabilities.mkb,
            ready: (setting: SettingDefinition) => {
                let note;
                let url;
                if (setting.unsupported) {
                    note = t('browser-unsupported-feature');
                    url = 'https://github.com/redphx/better-xcloud/issues/206#issuecomment-1920475657';
                } else {
                    note = t('mkb-disclaimer');
                    url = 'https://better-xcloud.github.io/mouse-and-keyboard/#disclaimer';
                }

                setting.unsupportedNote = () => CE('a', {
                    href: url,
                    target: '_blank',
                }, '⚠️ ' + note);
            },
        },

        [GlobalPref.NATIVE_MKB_MODE]: {
            requiredVariants: 'full',
            label: t('native-mkb'),
            default: NativeMkbMode.DEFAULT,
            options: {
                [NativeMkbMode.DEFAULT]: t('default'),
                [NativeMkbMode.OFF]: t('off'),
                [NativeMkbMode.ON]: t('on'),
            },
            ready: (setting: SettingDefinition) => {
                if (STATES.browser.capabilities.emulatedNativeMkb) {
                } else if (UserAgent.isMobile()) {
                    setting.unsupported = true;
                    setting.unsupportedValue = NativeMkbMode.OFF;
                    delete (setting as any).options[NativeMkbMode.DEFAULT];
                    delete (setting as any).options[NativeMkbMode.ON];
                } else {
                    delete (setting as any).options[NativeMkbMode.ON];
                }
            },
        },

        [GlobalPref.NATIVE_MKB_FORCED_GAMES]: {
            label: t('force-native-mkb-games'),
            default: [],
            unsupported: !AppInterface && UserAgent.isMobile(),
            ready: (setting: SettingDefinition) => {
                if (!setting.unsupported) {
                    (setting as any).multipleOptions = GhPagesUtils.getNativeMkbCustomList(true);

                    BxEventBus.Script.once('list.forcedNativeMkb.updated', payload => {
                        (setting as any).multipleOptions = payload.data.data;
                    });
                }
            },
            params: {
                size: 6,
            },
        },

        [GlobalPref.UI_REDUCE_ANIMATIONS]: {
            label: t('reduce-animations'),
            default: isSmartTv,
        },

        [GlobalPref.LOADING_SCREEN_GAME_ART]: {
            requiredVariants: 'full',
            label: t('show-game-art'),
            default: true,
        },
        [GlobalPref.LOADING_SCREEN_SHOW_WAIT_TIME]: {
            label: t('show-wait-time'),
            default: true,
        },
        [GlobalPref.LOADING_SCREEN_ROCKET]: {
            label: t('rocket-animation'),
            default: 'show',
            options: {
                show: t('rocket-always-show'),
                'hide-queue': t('rocket-hide-queue'),
                hide: t('rocket-always-hide'),
            },
        },

        [GlobalPref.UI_CONTROLLER_FRIENDLY]: {
            label: t('controller-friendly-ui'),
            default: BX_FLAGS.DeviceInfo.deviceType !== 'unknown',
        },

        [GlobalPref.UI_LAYOUT]: {
            requiredVariants: 'full',
            label: t('layout'),
            default: isSmartTv ? UiLayout.TV : UiLayout.DEFAULT,
            options: {
                [UiLayout.DEFAULT]: t('default'),
                [UiLayout.NORMAL]: t('normal'),
                [UiLayout.TV]: t('smart-tv'),
            },
        },

        [GlobalPref.UI_SCROLLBAR_HIDE]: {
            label: t('hide-scrollbar'),
            default: false,
        },

        [GlobalPref.UI_HIDE_SECTIONS]: {
            requiredVariants: 'full',
            label: t('hide-sections'),
            default: [],
            multipleOptions: {
                [UiSection.NEWS]: t('section-news'),
                [UiSection.FRIENDS]: t('section-play-with-friends'),
                [UiSection.NATIVE_MKB]: t('section-native-mkb'),
                [UiSection.TOUCH]: t('section-touch'),
                [UiSection.MOST_POPULAR]: t('section-most-popular'),
                [UiSection.BOYG]: t('stream-your-own-game'),
                [UiSection.RECENTLY_ADDED]: t('section-recently-added'),
                [UiSection.LEAVING_SOON]: t('section-leaving-soon'),
                [UiSection.GENRES]: t('section-genres'),
                [UiSection.ALL_GAMES]: t('section-all-games'),
            },
            params: {
                size: 0,
            },
        },

        [GlobalPref.UI_GAME_CARD_SHOW_WAIT_TIME]: {
            requiredVariants: 'full',
            label: t('show-wait-time-in-game-card'),
            default: true,
        },

        [GlobalPref.BLOCK_TRACKING]: {
            label: t('disable-xcloud-analytics'),
            default: false,
        },
        [GlobalPref.BLOCK_FEATURES]: {
            requiredVariants: 'full',
            label: t('disable-features'),
            default: [],
            multipleOptions: {
                [BlockFeature.CHAT]: t('chat'),
                [BlockFeature.FRIENDS]: t('friends-followers'),
                [BlockFeature.NOTIFICATIONS_INVITES]: t('notifications') + ': ' + t('invites'),
                [BlockFeature.NOTIFICATIONS_ACHIEVEMENTS]: t('notifications') + ': ' + t('achievements'),
                [BlockFeature.REMOTE_PLAY]: t('remote-play'),
            },
        },


        [GlobalPref.USER_AGENT_PROFILE]: {
            label: t('user-agent-profile'),
            note: '⚠️ ' + t('unexpected-behavior'),
            default: (BX_FLAGS.DeviceInfo.deviceType === 'android-tv' || BX_FLAGS.DeviceInfo.deviceType === 'webos') ? UserAgentProfile.VR_OCULUS : 'default',
            options: {
                [UserAgentProfile.DEFAULT]: t('default'),
                [UserAgentProfile.WINDOWS_EDGE]: 'Edge + Windows',
                [UserAgentProfile.MACOS_SAFARI]: 'Safari + macOS',
                [UserAgentProfile.VR_OCULUS]: 'Android TV',
                [UserAgentProfile.SMART_TV_GENERIC]: 'Smart TV',
                [UserAgentProfile.SMART_TV_TIZEN]: 'Samsung Smart TV',
                [UserAgentProfile.CUSTOM]: t('custom'),
            },
        },
        [GlobalPref.AUDIO_MIC_ON_PLAYING]: {
            label: t('enable-mic-on-startup'),
            default: false,
        },
        [GlobalPref.AUDIO_VOLUME_CONTROL_ENABLED]: {
            requiredVariants: 'full',
            label: t('enable-volume-control'),
            default: false,
        },

        [GlobalPref.REMOTE_PLAY_STREAM_RESOLUTION]: {
            requiredVariants: 'full',
            default: StreamResolution.DIM_1080P,
            options: {
                [StreamResolution.DIM_720P]: '720p',
                [StreamResolution.DIM_1080P]: '1080p',
                [StreamResolution.DIM_1080P_HQ]: '1080p (HQ)',
            },
        },

        [GlobalPref.REMOTE_PLAY_PREFER_IPV6]: {
            requiredVariants: 'full',
            default: false,
        },

        [GlobalPref.GAME_FORTNITE_FORCE_CONSOLE]: {
            requiredVariants: 'full',
            label: '🎮 ' + t('fortnite-force-console-version'),
            default: false,
            note: t('fortnite-allow-stw-mode'),
        },
    };

    constructor() {
        super(StorageKey.GLOBAL, GlobalSettingsStorage.DEFINITIONS);
    }
}
