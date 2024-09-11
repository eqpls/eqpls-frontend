// javascript here

common.init(async () => { // main task
	document.getElementById("eqpls-access-token").innerText = common.auth.accessToken;
	
	common.wsock.connect(
		"/router/websocket", // wsock url
		async (socket, data) => { // receiver
			console.log(socket, data);
		},
		async (socket) => { // initiator
			await socket.sendData("hello", "world");
		}
	);
}).login();