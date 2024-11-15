export const throwError = error => {
  throw new Error(error);
};

export const GenerateCustomError = (res, message, status) => {
  return res.status(status || 500).send({ status: "error", message });
};
// 40*

export const BadRequest = (res, message) => {
  return res.status(400).send({ status: "error", message });
};

export const UnauthorizedRequest = (res, message) => {
  return res.status(401).send({ status: "error", message });
};

export const ForbiddenRequest = (res, message) => {
  return res.status(403).send({ status: "error", message });
};

export const UnprocessableRequest = (res, message) => {
  return res.status(422).send({ status: "error", message });
};

//50*
export const ServerError = (res, message) => {
  return res.status(500).send({ status: "error", message });
};
