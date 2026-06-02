import Constants from "expo-constants";

const FALLBACK_IP = "10.106.124.181";

const hostFromExpo =
	Constants.expoConfig?.hostUri ||
	Constants.manifest2?.extra?.expoClient?.hostUri ||
	Constants.manifest?.debuggerHost;

const detectedIp = hostFromExpo?.split(":")?.[0];
const IP = process.env.EXPO_PUBLIC_API_HOST || detectedIp || FALLBACK_IP;

export default IP; 