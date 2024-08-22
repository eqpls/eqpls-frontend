// javascript here

var main = () => {
	document.getElementById("eqpls-access-token").innerText = window.common.auth.accessToken;

	window.common.wsock.connect(
		`/router/websocket?org=${window.common.auth.getOrg()}&token=${window.common.auth.accessToken}`,
		(data) => {
			console.log(data);
		}
	);
};

window.common.init(() => {
	window.common.auth.login(main, () => { // login failed
		console.error("index.html login error");
	});
});
