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
        totpCode: { label: "Authentication code", type: "text" },
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
              ...(credentials.totpCode ? { totpCode: credentials.totpCode } : {}),
            }),
          });

          if (!res.ok) {
            // The API distinguishes "wrong password" from "your password was
            // right, now enter your code". NextAuth's authorize can only return
            // null or throw, so the challenge is thrown as an error whose
            // message the login page recognises — otherwise an account with
            // two-factor on could never sign in.
            const body = (await res.json().catch(() => null)) as {
              requiresTotp?: boolean;
              error?: string;
            } | null;

            if (body?.requiresTotp) {
              throw new Error(`TOTP_REQUIRED:${body.error ?? ""}`);
            }
            return null;
          }

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
        } catch (err) {
          // The two-factor challenge is deliberately rethrown: NextAuth passes
          // a thrown message through to the client as the error, which is how
          // the login page knows to ask for a code.
          if (err instanceof Error && err.message.startsWith("TOTP_REQUIRED")) {
            throw err;
          }
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
