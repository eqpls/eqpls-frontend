// javascript here

window.common.init(async () => { // main task
	document.getElementById("eqpls-access-token").innerText = window.common.auth.accessToken;

	window.common.wsock.connect(
		"/router/websocket", // wsock url
		async () => { // initiator
			await socket.sendData("hello", "world");
		},
		async (socket, data) => { // receiver
			console.log(socket, data);
		}
	);
}).login();