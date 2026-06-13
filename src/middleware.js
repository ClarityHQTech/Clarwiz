export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/campaigns/:path*",
    "/collaterals/:path*",
    "/integrations/:path*",
    "/context/:path*",
    "/teams/:path*",
    "/profile/:path*",
    "/admin/:path*",
    "/invite/:path*",
  ],
};
