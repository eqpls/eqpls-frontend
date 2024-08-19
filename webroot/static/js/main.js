// javascript here

var socket = null;
var carts = [];
var rounds = [];

function drawCartData() {
	let html = '';
	carts.forEach((cart)=> {
		html += `
<div id="${cart.id}">
	<h3>${cart.name} <small>${cart.id}</small></h3>
	<span>${cart.manager.name}</span> <span>[${cart.location.x},${cart.location.y}]</span>
</div>
`;
	});
	document.getElementById("epqls-cart-data").innerHTML = html;
};

function drawRoundData() {
	let html = '';
	rounds.forEach((round)=> {
		html += `
<div id="${round.id}">
	<h3>${round.name}</h3>
</div>
`;
	});
	document.getElementById("eqpls-round-data").innerHTML = html;
};




Auth.login(()=> {
	document.getElementById("eqpls-access-token").innerText = Auth.accessToken;

	Rest.get("/uerp/v1/demo/device/cart?$archive&$orderby=name&$order=asc", (data)=> {
		carts = data;
		drawCartData();
	});

	Rest.get("/uerp/v1/demo/operation/round?$archive&$orderby=name&$order=asc", (data)=> {
		rounds = data;
		drawRoundData();
	});

	socket = WSock.connect(
		'/router/websocket/admin', // admin target url
		(data)=> { // recv handler
			console.log(data);
			for (let i=0; i<carts.length; i++) {
				let cart = carts[i];
				if (cart.id == data.id) {
					cart.location.x = data.location.x;
					cart.location.y = data.location.y;
					break;
				}
			}
			drawCartData();
		}
	);

}, ()=> {
	console.error("login error");
});