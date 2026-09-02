export class User {
	id: number;
	email: string;
	token: string;

	created_at: string;
	updated_at: string;

	constructor(jsonData: any) {
		this.id = jsonData.id;
		this.email = jsonData.email;
		this.token = jsonData.token;
		this.created_at = jsonData.created_at;
		this.updated_at = jsonData.updated_at;
	}

	public static storeUser(user: User) {
		localStorage.setItem('current_user_session', JSON.stringify({user: user}));
	}
	public static loadUser(): User {
		const defaultUser = JSON.stringify({user: null});
		return JSON.parse(localStorage.getItem('current_user_session') || defaultUser).user;
	}
	public static clearUser() {
		localStorage.removeItem('current_user_session');
	}
}
