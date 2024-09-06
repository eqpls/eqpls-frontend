// javascript here

async function sampleWSockInitiator(socket) {
	await socket.sendData("hello", "world");
};

async function sampleWSockReceiver(socket, data) {
	console.log(data);
};

async function main() {
	window.module.data.login();

	document.getElementById("eqpls-access-token").innerText = window.common.auth.accessToken;

	window.common.wsock.connect(
		"/router/websocket",
		sampleWSockReceiver,
		sampleWSockInitiator
	);
};

window.common.init(main).login();