// javascript here

var wsockHandler = (data) => {
	console.log(data);
};

var main = () => {
	document.getElementById("eqpls-access-token").innerText = window.common.auth.accessToken;

	window.common.wsock.connect(
		`/router/websocket?org=${window.common.auth.getOrg()}&token=${window.common.auth.accessToken}`,
		wsockHandler
	);
};

window.common.init(() => {
	window.common.auth.login(main, () => { // login failed
		console.error("login error");
	});
});
