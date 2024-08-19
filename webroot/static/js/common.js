// UTIL
var Util = Util || {};

Util.parseQueryToMap =(query)=> {
	let map = {};
	query.replace("?", "").split("&").forEach((q)=> {
		let kv = q.split("=");
		map[kv[0]] = kv[1];
	});
	return map;
};

// AUTH
var Auth = Auth || {};

Auth.setRealm =(realm)=> {
	if (realm) {
		Auth.realm = realm;
		localStorage.setItem("authRealm", realm);
	} else {
		Auth.realm = DEFAULT_AUTH_REALM;
		localStorage.setItem("authRealm", DEFAULT_AUTH_REALM);
	}
	return Auth.realm;
};

Auth.getRealm =()=> {
	let realm = Auth.realm;
	if (realm) { return realm; }
	realm = localStorage.getItem("authRealm");
	if (realm) {
		Auth.realm = realm;
		return realm;
	}
	return Auth.setRealm();
};

Auth.__load_all_auth_data__ =()=> {
	Auth.accessToken = localStorage.getItem("authAccessToken");
	Auth.refreshToken = localStorage.getItem("authRefreshToken");
	Auth.idToken = localStorage.getItem("authIdToken");
	Auth.bearerToken = localStorage.getItem("authBearerToken");
	Auth.consoleToken = localStorage.getItem("authConsoleToken");
};

Auth.__remove_all_auth_data__ =()=> {
	localStorage.removeItem("authUsername");
	Auth.username = null;
	Auth.userInfo = null;
	Auth.apiHeaders = null;
	localStorage.removeItem("authAccessToken");
	Auth.accessToken = null;
	localStorage.removeItem("authRefreshToken");
	Auth.refreshToken = null;
	localStorage.removeItem("authIdToken");
	Auth.idToken = null;
	localStorage.removeItem("authBearerToken");
	Auth.bearerToken = null;
	localStorage.removeItem("authConsoleToken");
	Auth.consoleToken = null;
	localStorage.removeItem("authDataToken");
	Auth.dataToken = null;
};

Auth.checkUserInfo =(resultHandler, errorHandler)=> {
	Auth.username = localStorage.getItem("authUsername");
	if (Auth.username) {
		Auth.userInfo = JSON.parse(localStorage.getItem("authUserInfo"));
		Auth.__load_all_auth_data__();
		Auth.apiHeaders = {
			"Content-Type": "application/json; charset=utf-8",
			"Accept": "application/json; charset=utf-8",
			"Authorization": Auth.bearerToken,
			"Realm": Auth.getRealm()
		};
		if (resultHandler) { resultHandler(); }
	} else {
		Auth.bearerToken = localStorage.getItem("authBearerToken");
		if (Auth.bearerToken) {
			fetch(`/auth/realms/${Auth.getRealm()}/protocol/openid-connect/userinfo`, {
				headers: {Authorization: Auth.bearerToken}
			}).then((res)=> {
				if (res.ok) { return res.json(); }
				Auth.__remove_all_auth_data__();
				if (errorHandler) { errorHandler(); }
				throw res
			}).then((userInfo)=> {
				Auth.__load_all_auth_data__();
				Auth.username = userInfo.preferred_username;
				Auth.userInfo = userInfo;
				Auth.apiHeaders = {
					"Content-Type": "application/json; charset=utf-8",
					"Accept": "application/json; charset=utf-8",
					"Authorization": Auth.bearerToken,
					"Realm": Auth.getRealm()
				};
				localStorage.setItem("authUsername", Auth.username);
				localStorage.setItem("authUserInfo", JSON.stringify(Auth.userInfo));
				if (resultHandler) { resultHandler(); }
			})
		} else {
			Auth.__remove_all_auth_data__();
			if (errorHandler) { errorHandler(); }
		}
	}
};

Auth.login =(resultHandler, errorHandler)=> {

	if (resultHandler) { Auth.loginResultHandler = resultHandler; }
	else { resultHandler = Auth.loginResultHandler; }
	if (errorHandler) { Auth.loginErrorHandler = errorHandler; }
	else { errorHandler = Auth.loginErrorHandler; }

	function login_keycloak(resultHandler, errorHandler) {
		Auth.keycloak = new Keycloak({
			url: DEFAULT_AUTH_URL,
			realm: Auth.getRealm(),
			clientId: DEFAULT_AUTH_CLIENT_ID
		});
		Auth.keycloak.onAuthSuccess =()=> {
			localStorage.setItem("authAccessToken", Auth.keycloak.token);
			localStorage.setItem("authRefreshToken", Auth.keycloak.refreshToken);
			localStorage.setItem("authIdToken", Auth.keycloak.idToken);
			localStorage.setItem("authBearerToken", `Bearer ${Auth.keycloak.token}`);
			Auth.checkUserInfo(resultHandler, errorHandler);
		};
		Auth.keycloak.onAuthError =()=> {
			Auth.__remove_all_auth_data__();
			if (errorHandler) { errorHandler(); }
		};
		Auth.keycloak.init({
			onLoad: 'login-required'
		});
	}

	function check_console_service(resultHandler, errorHandler) {
		if (DEFAULT_TERM_SERVICE) {
			Auth.consoleToken = localStorage.getItem("authConsoleToken");
			if (Auth.consoleToken) {
				fetch(`/guacamole/api/session/data/postgresql/users/${Auth.username}`, {
					headers: {"Guacamole-Token": Auth.consoleToken}
				}).then((res)=> {
					if (res.ok) {
						if (resultHandler) { resultHandler(); }
					} else {
						localStorage.removeItem("authConsoleToken");
						window.location.replace("/guacamole/api/ext/openid/login");
					}
				});
			} else if (window.location.hash && window.location.hash.indexOf("id_token=")) {
				fetch("/guacamole/api/tokens", {
					method: "POST",
					headers: {
						"Content-Type": "application/x-www-form-urlencoded",
						"Accept": "application/json"
					},
					body: window.location.hash.replace("#", "")
				}).then((res)=> {
					if (res.ok) { return res.json(); }
					localStorage.removeItem("authConsoleToken");
					if (errorHandler) { errorHandler(); }
					throw res;
				}).then((guacamole)=> {
					localStorage.setItem("GUAC_AUTH", JSON.stringify(guacamole));
					localStorage.setItem("authConsoleToken", guacamole.authToken);
					window.location.replace("/");
				});
			} else { window.location.replace("/guacamole/api/ext/openid/login"); }
		} else {
			if (resultHandler) { resultHandler(); }
		}
	};

	function check_data_service(resultHandler, errorHandler) {
		if (DEFAULT_DATA_SERVICE) {
			Auth.dataToken = localStorage.getItem("authDataToken");
			if (Auth.dataToken) {
				check_console_service(resultHandler, errorHandler);
			} else {
				fetch("/minio/ui/api/v1/login").then((res)=> {
					if (res.ok) { return res.json(); }
					localStorage.removeItem("authDataToken");
					if (errorHandler) { errorHandler(); }
					throw res;
				}).then((data)=> {
					fetch(data.redirectRules[0].redirect).then((res)=> {
						if (res.ok) { return res.json(); }
						localStorage.removeItem("authDataToken");
						if (errorHandler) { errorHandler(); }
						throw res;
					}).then((data)=> {
						data.state = decodeURIComponent(data.state);
						fetch("/minio/ui/api/v1/login/oauth2/auth", {
							method: "POST",
							headers: {
								"Content-Type": "application/json"
							},
							body: JSON.stringify(data)
						}).then((res)=> {
							if(res.ok) {
								fetch("/minio/ui/cookie_to_data").then((res)=> {
									if (res.ok) { return res.json(); }
									localStorage.removeItem("authDataToken");
									if (errorHandler) { errorHandler(); }
									throw res;
								}).then((data)=> {
									localStorage.setItem("authDataToken", data.token);
									check_console_service(resultHandler, errorHandler);
								});
							} else {
								localStorage.removeItem("authDataToken");
								if (errorHandler) { errorHandler(); }
								throw res;
							}
						});
					});
				});
			}
		} else {
			check_console_service(resultHandler, errorHandler);
		}
	};

	function check_authorization(resultHandler, errorHandler) {
		Auth.checkUserInfo(()=> {
			check_data_service(resultHandler, errorHandler);
		}, ()=> {
			login_keycloak(()=> {
				check_data_service(resultHandler, errorHandler);
			}, errorHandler)
		});
	};

	check_authorization(resultHandler, errorHandler);
};

Auth.logout =()=> {
	let idToken = Auth.idToken;
	Auth.__remove_all_auth_data__();
	if (idToken) {
		window.location.replace(`/auth/realms/${Auth.getRealm()}/protocol/openid-connect/logout?id_token_hint=${idToken}&post_logout_redirect_uri=/`);
	} else {
		window.location.replace("/");
	}
}

// DATA
var Data = Data || {};

Data.createAccessKey =(name, description, accessKey, secretKey, resultHandler, errorHandler)=> {
	fetch("/minio/ui/api/v1/service-account-credentials", {
		method: "POST",
		headers: {"Content-Type": "application/json"},
		body: JSON.stringify({
			name: name,
			comment: name,
			description: description,
			policy: "",
			accessKey: accessKey,
			secretKey: secretKey,
			url: "https://eqpls.com",
			expiry: null
		})
	}).then((res)=> {
		if (res.ok) { return res.json(); }
		if (errorHandler) { errorHandler(); }
		throw res;
	}).then((data)=> {
		console.log(data);
		if (resultHandler) { resultHandler(data); }
	});
};

// CONSOLE
var Console = Console || {};

Console.openNewWindow =(username, hostname, hostport)=> {
	hostport = hostport ? hostport : "22";
	window.open(`/static/html/console.html?username=${username}&hostname=${hostname}&hostport=${hostport}`, "_blank", "menubar=no,status=no,titlebar=no,toolbar=no");
};

Console.openNewTab =(username, hostname, hostport)=> {
	hostport = hostport ? hostport : "22";
	window.open(`/static/html/console.html?username=${username}&hostname=${hostname}&hostport=${hostport}`, "_blank");
};

Console.openOnDom =(dom, username, hostname, hostport)=> {
	hostport = hostport ? hostport : "22";
	fetch(`/guacamole/api/session/ext/quickconnect/create?token=${Auth.consoleToken}`, {
		method: "POST",
		headers: {"Content-Type": "application/x-www-form-urlencoded"},
		body: `uri=ssh://${username}@${hostname}:${hostport}`
	}).then((res)=> {
		if (res.ok) { return res.json(); }
		throw res;
	}).then((data)=> {
		Console.connectToSSH(dom, data.identifier);
	})
};

Console.closeByException =(message)=> {
	window.alert(message);
	window.close();
};

Console.connectToSSH =(dom, id)=> {
	let guac = new Guacamole.Client(new Guacamole.WebSocketTunnel('/guacamole/websocket-tunnel'));
	let guacDisp = guac.getDisplay().getElement();
	dom.appendChild(guacDisp);

	let options = `token=${Auth.consoleToken}&GUAC_ID=${id}&GUAC_DATA_SOURCE=quickconnect&GUAC_TYPE=c`;
	options += `&GUAC_WIDTH=${Math.round(window.innerWidth)}&GUAC_HEIGHT=${Math.round(window.innerHeight)}&GUAC_DPI=96`;
	options += "&GUAC_AUDIO=audio/L8&GUAC_AUDIO=audio/L16&GUAC_IMAGE=image/jpeg&GUAC_IMAGE=image/png&GUAC_IMAGE=image/webp&GUAC_TIMEZONE=Asia/Seoul";

	guac.connect(options);
	guac.onerror =(error)=> {
		console.error(error);
		Console.closeByException("문제가 발생하여 연결하지 못했습니다");
	};
	guac.onstatechange =(state)=> {
		switch(state) {
			case 3:
				console.log("connected");
				break;
			case 4:
				console.log("logout");
				break;
			case 5:
				console.log("disconnected");
				window.close();
				break;
		}
	};
	guac.onclipboard =(stream, mimetype)=> {
		if (mimetype == "text/plain") {
			let reader = new Guacamole.StringReader(stream);
			reader.ontext =(data)=> {navigator.clipboard.writeText(data);};
		}
	};
	window.onauxclick =()=> {
		navigator.clipboard.readText().then((data)=> {
			let stream = guac.createClipboardStream("text/plain");
			let writer = new Guacamole.StringWriter(stream);
			writer.sendText(data);
			writer.sendEnd();
		});
	};
	window.onresize =()=> guac.sendSize(Math.round(window.innerWidth), Math.round(window.innerHeight));
	window.onunload =()=> guac.disconnect();
	window.onclose =()=> guac.disconnect();

	let guacMouse = new Guacamole.Mouse(guacDisp);
	guacMouse.onmousedown =(state)=> guac.sendMouseState(state);
	guacMouse.onmouseup =(state)=> guac.sendMouseState(state);
	guacMouse.onmousemove =(state)=> guac.sendMouseState(state);

	let guacKbd = new Guacamole.Keyboard(document);
	guacKbd.onkeydown =(k)=> guac.sendKeyEvent(1, k);
	guacKbd.onkeyup =(k)=> guac.sendKeyEvent(0, k);
};

// REST
var Rest = Rest || {};

Rest.get =(url, resultHandler, errorHandler)=> {
	fetch(url, {
		headers: Auth.apiHeaders
	}).then((res)=> {
		if (res.ok) { return res.json(); }
		if (errorHandler) { errorHandler(res); }
		throw res
	}).then((data)=> {
		if (resultHandler) { resultHandler(data); }
	});
};

Rest.post =(url, data, resultHandler, errorHandler)=> {
	fetch(url, {
		method: "POST",
		headers: Auth.apiHeaders,
		body: JSON.stringify(data)
	}).then((res)=> {
		if (res.ok) { return res.json(); }
		if (errorHandler) { errorHandler(res); }
		throw res
	}).then((data)=> {
		if (resultHandler) { resultHandler(data); }
	});
};

Rest.put =(url, data, resultHandler, errorHandler)=> {
	fetch(url, {
		method: "PUT",
		headers: Auth.apiHeaders,
		body: JSON.stringify(data)
	}).then((res)=> {
		if (res.ok) { return res.json(); }
		if (errorHandler) { errorHandler(res); }
		throw res
	}).then((data)=> {
		if (resultHandler) { resultHandler(data); }
	});
};

Rest.delete =(url, resultHandler, errorHandler)=> {
	fetch(url, {
		method: "DELETE",
		headers: Auth.apiHeaders
	}).then((res)=> {
		if (res.ok) { return res.json(); }
		if (errorHandler) { errorHandler(res); }
		throw res
	}).then((data)=> {
		if (resultHandler) { resultHandler(data); }
	});
};

// WEBSOCKET
var WSock = WSock || {};

WSock.connect =(url, recvHandler, openHandler, closeHandler, errorHandler)=> {
	let socket = null;
	try {
		socket = new WebSocket(`wss://${DEFAULT_ENDPOINT}${url}?org=${Auth.realm}&token=${Auth.accessToken}`);
	} catch (e) {
		if (errorHandler) { errorHandler(e); }
		throw e
	}
	socket.onmessage =(event)=> {
		console.log("ws:recv");
		if (recvHandler) { recvHandler(JSON.parse(event.data)); }
	};
	socket.onopen =(event)=> {
		console.log("ws:open");
		if (openHandler) { openHandler(event); }
	};
	socket.onclose =(event)=> {
		console.log("ws:close");
		if (closeHandler) { closeHandler(event); }
	};
	socket.onerror =(event)=> {
		console.log("ws:error");
		if (errorHandler) { errorHandler(event); }
	};
	return socket;
};

