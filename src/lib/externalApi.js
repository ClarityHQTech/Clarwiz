import { NextResponse } from "next/server";

export const EXTERNAL_DEFAULT_PAGE_LIMIT = 20;
export const EXTERNAL_MAX_PAGE_LIMIT = 100;

export const ExternalErrorCodes = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
};

export function getRequestId(request) {
  return request.headers.get("x-request-id") || crypto.randomUUID();
}

export function ok(request, data, init = {}) {
  return NextResponse.json(
    {
      data,
      requestId: getRequestId(request),
    },
    init
  );
}

export function okList(request, data, pagination, init = {}) {
  const payload = {
    data,
    requestId: getRequestId(request),
  };
  if (pagination) payload.pagination = pagination;
  return NextResponse.json(payload, init);
}

export function error(request, status, code, message, details) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
      requestId: getRequestId(request),
    },
    { status }
  );
}

export function parsePagination(request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(
    EXTERNAL_MAX_PAGE_LIMIT,
    Math.max(1, Number(searchParams.get("limit")) || EXTERNAL_DEFAULT_PAGE_LIMIT)
  );
  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}
