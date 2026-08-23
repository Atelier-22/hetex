import "next-auth";
import "next-auth/jwt";

// Teaches NextAuth's types about the two things Hetex adds to a session: the
// user's id and the Hetex API bearer token. Without this, every read of
// `session.accessToken` needs a cast.
declare module "next-auth" {
  interface Session {
    accessToken?: string;
    user?: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    id: string;
    accessToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    accessToken?: string;
  }
}
