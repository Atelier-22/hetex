import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { API_BASE_URL } from "./api";

/**
 * The frontend no longer talks to a database. Credentials are verified by the
 * Hetex API, which returns a bearer token; NextAuth carries that token inside
 * its own encrypted JWT session cookie so the browser never has to store it
 * somewhere a script could read.
 */
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const res = await fetch(`${API_BASE_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          if (!res.ok) return null;

          const data = (await res.json()) as {
            token: string;
            user: { id: string; email: string; displayName: string | null };
          };

          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.displayName ?? data.user.email,
            accessToken: data.token,
          };
        } catch {
          // The API being unreachable is indistinguishable from bad credentials
          // as far as NextAuth's return type is concerned. The login page shows
          // a generic failure; the real cause is in the server logs.
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.accessToken = user.accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
      }
      session.accessToken = token.accessToken;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
