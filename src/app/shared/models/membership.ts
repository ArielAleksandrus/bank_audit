import { MembershipRole } from './company';

export class Membership {
	user_id: number;
	email: string;
	role: MembershipRole;

	constructor(jsonData: any) {
		this.user_id = jsonData.user_id;
		this.email = jsonData.email;
		this.role = jsonData.role;
	}

	public static fromJsonArray(jsonArr: any[]): Membership[] {
		return (jsonArr || []).map(data => new Membership(data));
	}
}
