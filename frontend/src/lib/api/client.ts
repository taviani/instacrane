const API_BASE = '/api';

class ApiError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

function getToken(): string | null {
	return localStorage.getItem('instacrane_token');
}

export function setToken(token: string) {
	localStorage.setItem('instacrane_token', token);
}

export function clearToken() {
	localStorage.removeItem('instacrane_token');
}

export function isAuthenticated(): boolean {
	return !!getToken();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
	const headers: Record<string, string> = {};
	const token = getToken();
	if (token) {
		headers['Authorization'] = `Bearer ${token}`;
	}
	if (!(options.body instanceof FormData)) {
		headers['Content-Type'] = 'application/json';
	}

	const res = await fetch(`${API_BASE}${path}`, {
		...options,
		headers: { ...headers, ...options.headers }
	});

	if (!res.ok) {
		const body = await res.json().catch(() => ({ detail: 'Erreur inconnue' }));
		throw new ApiError(res.status, body.detail || res.statusText);
	}

	if (res.status === 204) return undefined as T;
	return res.json();
}

export const api = {
	// Auth
	register: (data: { username: string; email: string; password: string; display_name?: string }) =>
		request<{ id: string }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

	login: (data: { login: string; password: string }) =>
		request<{ access_token: string }>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

	// Users
	getMe: () => request<any>('/users/me'),
	updateMe: (data: { display_name?: string; bio?: string }) =>
		request<any>('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
	uploadAvatar: (file: File) => {
		const form = new FormData();
		form.append('file', file);
		return request<any>('/users/me/avatar', { method: 'POST', body: form });
	},
	getProfile: (username: string) => request<any>(`/users/${username}`),
	searchUsers: (query: string) => request<any[]>(`/users/search/${encodeURIComponent(query)}`),
	follow: (userId: string) => request<void>(`/users/${userId}/follow`, { method: 'POST' }),
	unfollow: (userId: string) => request<void>(`/users/${userId}/follow`, { method: 'DELETE' }),

	// Posts
	createPost: (file: File, caption?: string) => {
		const form = new FormData();
		form.append('file', file);
		if (caption) form.append('caption', caption);
		return request<any>('/posts', { method: 'POST', body: form });
	},
	getFeed: (page = 1) => request<any[]>(`/posts/feed?page=${page}`),
	getExplore: (page = 1) => request<any[]>(`/posts/explore?page=${page}`),
	getPost: (id: string) => request<any>(`/posts/${id}`),
	deletePost: (id: string) => request<void>(`/posts/${id}`, { method: 'DELETE' }),
	likePost: (id: string) => request<void>(`/posts/${id}/like`, { method: 'POST' }),
	unlikePost: (id: string) => request<void>(`/posts/${id}/like`, { method: 'DELETE' }),
	getComments: (postId: string, page = 1) => request<any[]>(`/posts/${postId}/comments?page=${page}`),
	addComment: (postId: string, content: string) =>
		request<any>(`/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ content }) })
};
