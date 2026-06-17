/*
    Project: Hoot Mobile
    -------------------

    File: util.ts

    Purpose:

        Provides core utility functions and types for interacting with
        the Lotide API, including request handling and authentication.

    Responsibilities:

        • Define core request methods and types
        • Implement the base API request function (lotideRequest)
        • Handle authentication header generation
        • Provide error logging for API interactions

    This file intentionally does NOT contain:

        • Specific API endpoint implementations (see Post.ts, User.ts, etc.)
        • Business logic or state management
*/

/* ------------------------------------------------------------------------- */
/* Types and Interfaces                                                      */
/* ------------------------------------------------------------------------- */

export type RequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type LotideError = Error & {
  body?: string;
  status?: number;
  path?: string;
  method?: RequestMethod;
};

export type JsonResponse = Response & {
  json(): Promise<unknown>;
};

/* ------------------------------------------------------------------------- */
/* Core Logic                                                                */
/* ------------------------------------------------------------------------- */

/**
    Checks if the current context has both an API URL and login information.
*/
export function hasLogin(ctx: LotideContext): boolean {
  return !!ctx.apiUrl && !!ctx.login;
}

/**
    Performs a request to the Lotide API.

    Authentication:
        By default, requests include a Bearer token in the Authorization header.
        This can be bypassed by setting noLogin to true for public endpoints.

    Error Handling:
        If the response is not OK, the function throws the response text.
        Errors are logged to the console with the request details and context.
*/
export async function lotideRequest(
  ctx: LotideContext,
  method: RequestMethod,
  path: string,
  body?: any,
  noLogin: boolean = false,
): Promise<JsonResponse> {
  if (!ctx.apiUrl) throw new Error("No API url");
  if (!noLogin && !ctx.login?.token) throw new Error("Not logged in");

  /*
     Fetch API interaction
     The Lotide API expects JSON bodies and returns JSON responses.
  */
  return fetch(`${ctx.apiUrl}/${path}`, {
    method,
    headers: buildHeaders(ctx),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
    .then(async res => {
      if (res.ok) {
        return res;
      } else {
        const errorBody = await res.text();
        const err = new Error(errorBody || "Request failed") as LotideError;
        err.status = res.status;
        err.body = errorBody;
        err.path = `${ctx.apiUrl}/${path}`;
        err.method = method;
        throw err;
      }
    })
    .catch(e => {
      console.error(`Lotide Service Error: ${method} ${ctx.apiUrl}/${path}\n${e}`);
      throw e;
    });
}

/* ------------------------------------------------------------------------- */
/* Helper Functions                                                          */
/* ------------------------------------------------------------------------- */

/**
    Builds the standard headers for a Lotide API request.
*/
export function buildHeaders(ctx: LotideContext): HeadersInit | undefined {
  return ctx.login?.token !== undefined
    ? {
        Authorization: `Bearer ${ctx.login.token}`,
        "Content-Type": "application/json",
      }
    : undefined;
}

export async function readJson(response: JsonResponse): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error("The Lotide server returned invalid JSON.");
  }
}

/* end of util.ts */
