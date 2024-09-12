// javascript here

Common.init(async () => { // main task
	document.getElementById("eqpls-access-token").innerText = Common.Auth.accessToken;

	console.log(await Common.DB.Test.t1.write("jhc", {id:"jhc",val:"janghyechurn"}));
	console.log(await Common.DB.Test.t1.readAll());
	console.log(await Common.DB.Test.t1.read("jhc"));
	console.log(await Common.DB.Test.t1.write("jhc", {id:"jhc",val:"JHC"}));
	console.log(await Common.DB.Test.t1.readAll());
	console.log(await Common.DB.Test.t1.read("jhc"));
	console.log(await Common.DB.Test.t1.delete("jhc"));
	console.log(await Common.DB.Test.t1.readAll());
	console.log(await Common.DB.Test.t1.read("jhc"));

	Common.WSock.connect(
		"/router/websocket", // wsock url
		async (socket, data) => { // receiver
			console.log(socket, data);
		},
		async (socket) => { // initiator
			await socket.sendJson(["hello", "world"]);
		}
	);
}).login();