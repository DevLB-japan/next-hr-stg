//////////////////////////////////////////////////////////
// middleware/globalErrorHandler.js
//////////////////////////////////////////////////////////
export function globalErrorHandler(err, req, res, next) {
  // body-parser が parse失敗すると SyntaxError になる
  console.error("[GlobalErrorHandler] error:", err);

  // もし JSON parseエラーなら 400, そうでなければ500
  if (
    err.type === "entity.parse.failed" ||
    err.type === "stream.not.readable"
  ) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  // fallback
  return res.status(500).json({ error: "Server Error" });
}
