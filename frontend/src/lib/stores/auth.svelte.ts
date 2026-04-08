import { api, setToken, clearToken, isAuthenticated } from '$lib/api/client';

interface User {
	id: string;
	username: string;
	display_name: string | null;
	bio: string | null;
	avatar_url: string | null;
}

let user = $state<User | null>(null);
let loading = $state(true);

export function getAuth() {
	return {
		get user() { return user; },
		get loading() { return loading; },
		get isLoggedIn() { return !!user; },

		async init() {
			if (!isAuthenticated()) {
				loading = false;
				return;
			}
			try {
				user = await api.getMe();
			} catch {
				clearToken();
			}
			loading = false;
		},

		async login(login: string, password: string) {
			const res = await api.login({ login, password });
			setToken(res.access_token);
			user = await api.getMe();
		},

		async register(username: string, email: string, password: string, display_name?: string) {
			await api.register({ username, email, password, display_name });
			const res = await api.login({ login: username, password });
			setToken(res.access_token);
			user = await api.getMe();
		},

		logout() {
			clearToken();
			user = null;
		}
	};
}
