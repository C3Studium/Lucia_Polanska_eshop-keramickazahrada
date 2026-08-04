import { describeResendError } from "../service"

describe("describeResendError", () => {
  it("keeps the Resend error name, which is what says whose fault it is", () => {
    // `validation_error` and `missing_api_key` are our configuration; a
    // `rate_limit_exceeded` or `application_error` is Resend's side.
    expect(
      describeResendError({
        name: "validation_error",
        message: "The `from` address is not a verified domain",
        statusCode: 403,
      })
    ).toBe(
      "validation_error: The `from` address is not a verified domain: HTTP 403"
    )
  })

  it("reads a thrown transport error, not just a returned one", () => {
    const thrown = new Error("connect ETIMEDOUT")
    thrown.name = "FetchError"

    expect(describeResendError(thrown)).toBe("FetchError: connect ETIMEDOUT")
  })

  it("says something useful when Resend returns neither an id nor an error", () => {
    expect(describeResendError(null)).toContain("nevrátil")
    expect(describeResendError(undefined)).toContain("nevrátil")
  })

  it("never degrades to [object Object]", () => {
    // The old code logged the raw error, which printed as [object Object] and
    // told nobody anything.
    const described = describeResendError({ unexpected: "shape" })

    expect(described).not.toContain("[object Object]")
    expect(described).toContain("unexpected")
  })

  it("passes a plain string through", () => {
    expect(describeResendError("Domain not found")).toBe("Domain not found")
  })
})
