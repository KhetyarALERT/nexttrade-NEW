const isNode = typeof window === 'undefined';
const windowObj = isNode ? { localStorage: new Map() } : window;
const storage = windowObj.localStorage;

const storageSet = (key, value) => {
	if (storage instanceof Map) {
		storage.set(key, String(value));
		return;
	}
	storage.setItem(key, String(value));
}

const storageGet = (key) => {
	if (storage instanceof Map) {
		return storage.get(key) ?? null;
	}
	return storage.getItem(key);
}

const storageRemove = (key) => {
	if (storage instanceof Map) {
		storage.delete(key);
		return;
	}
	storage.removeItem(key);
}

const toSnakeCase = (str) => {
	return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
	if (isNode) {
		return defaultValue;
	}
	const storageKey = `base44_${toSnakeCase(paramName)}`;
	const urlParams = new URLSearchParams(window.location.search);
	const searchParam = urlParams.get(paramName);
	if (removeFromUrl) {
		urlParams.delete(paramName);
		const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""
			}${window.location.hash}`;
		window.history.replaceState({}, document.title, newUrl);
	}
	if (searchParam) {
		storageSet(storageKey, searchParam);
		return searchParam;
	}
	if (defaultValue !== undefined && defaultValue !== null) {
		storageSet(storageKey, defaultValue);
		return defaultValue;
	}
	const storedValue = storageGet(storageKey);
	if (storedValue) {
		return storedValue;
	}
	return null;
}

const getAppParams = () => {
	if (getAppParamValue("clear_access_token") === 'true') {
		storageRemove('base44_access_token');
		storageRemove('base44_token');
	}
	return {
		appId: getAppParamValue("app_id", { defaultValue: import.meta.env.VITE_BASE44_APP_ID }),
		serverUrl: getAppParamValue("server_url", { defaultValue: import.meta.env.VITE_BASE44_BACKEND_URL }),
		token: getAppParamValue("access_token", { removeFromUrl: true }),
		fromUrl: getAppParamValue("from_url", { defaultValue: window.location.href }),
		functionsVersion: getAppParamValue("functions_version"),
	}
}


export const appParams = {
	...getAppParams()
}
