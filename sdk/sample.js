// javascript here

window.common.init(() => {
	window.common.auth.login(() => { // login success
		console.log("login success");
	}, () => { // login failed
		console.error("login error");
	});
});
