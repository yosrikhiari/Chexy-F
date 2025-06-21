export class JwtService {
  static getToken(): string | null {
    return localStorage.getItem("token");
  }

  static decodeToken(token: string): any | null {
    try {
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(atob(base64));
    } catch (error) {
      console.error("Error decoding JWT token:", error);
      return null;
    }
  }

  static getTokenExpirationDate(token: string): Date | null {
    const decoded = this.decodeToken(token);
    if (!decoded?.exp) return null;
    return new Date(decoded.exp * 1000);
  }

  static isTokenExpired(token: string): boolean {
    const expirationDate = this.getTokenExpirationDate(token);
    return expirationDate ? expirationDate.valueOf() < Date.now() : true;
  }

  static getRoles(token: string): string[] {
    const decoded = this.decodeToken(token);
    if (!decoded) return [];
    return [
      ...(decoded.realm_access?.roles || []),
      ...(decoded.resource_access?.account?.roles || []),
    ];
  }

  static getKeycloakId(): string | null {
    const token = this.getToken();
    if (!token) return null;
    const decoded = this.decodeToken(token);
    return decoded?.sub || null;
  }

  static removeToken(): void {
    localStorage.removeItem("token");
  }
}
