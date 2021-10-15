const express = require("express");
const expressApp = express();
expressApp.get("/", (req, res) => {
	res.send("<h1>hello</h1>");
});
expressApp.listen(3300, () => {
	`now listening to 3300`;
});
