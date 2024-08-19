window.common = window.common || {};

// UTIL
window.common.util = {};

window.common.util.parseQueryToMap = (query) => {
	let map = {};
	query.replace("?", "").split("&").forEach((q) => {
		let kv = q.split("=");
		map[kv[0]] = kv[1];
	});
	return map;
};

// AUTH
window.common.auth = {};

window.common.auth.setRealm = (realm) => {
	if (realm) {
		window.common.auth.realm = realm;
		localStorage.setItem("authRealm", realm);
	} else {
		window.common.auth.realm = DEFAULT_AUTH_REALM;
		localStorage.setItem("authRealm", DEFAULT_AUTH_REALM);
	}
	return window.common.auth.realm;
};

window.common.auth.getRealm = () => {
	if (window.common.auth.realm) { return window.common.auth.realm; }
	realm = localStorage.getItem("authRealm");
	if (realm) {
		window.common.auth.realm = realm;
		return realm;
	} else {
		return window.common.auth.setRealm();
	}
};

window.common.auth.__load_all_auth_data__ = () => {
	window.common.auth.accessToken = localStorage.getItem("authAccessToken");
	window.common.auth.refreshToken = localStorage.getItem("authRefreshToken");
	window.common.auth.idToken = localStorage.getItem("authIdToken");
	window.common.auth.termToken = localStorage.getItem("authTermToken");
	window.common.auth.dataToken = localStorage.getItem("authDataToken");
};

window.common.auth.__remove_all_auth_data__ = () => {
	localStorage.removeItem("authUsername");
	window.common.auth.username = null;
	window.common.auth.userInfo = null;
	window.common.auth.apiHeaders = null;
	localStorage.removeItem("authAccessToken");
	window.common.auth.accessToken = null;
	localStorage.removeItem("authRefreshToken");
	window.common.auth.refreshToken = null;
	localStorage.removeItem("authIdToken");
	window.common.auth.idToken = null;
	localStorage.removeItem("authTermToken");
	window.common.auth.termToken = null;
	localStorage.removeItem("authDataToken");
	window.common.auth.dataToken = null;
};

window.common.auth.checkUserInfo = (resultHandler, errorHandler) => {
	window.common.auth.username = localStorage.getItem("authUsername");
	if (window.common.auth.username) {
		window.common.auth.userInfo = JSON.parse(localStorage.getItem("authUserInfo"));
		window.common.auth.__load_all_auth_data__();
		window.common.auth.apiHeaders = {
			"Content-Type": "application/json; charset=utf-8",
			"Accept": "application/json; charset=utf-8",
			"Authorization": `Bearer ${window.common.auth.accessToken}`,
			"Realm": window.common.auth.getRealm()
		};
		if (resultHandler) { resultHandler(); }
	} else {
		window.common.auth.accessToken = localStorage.getItem("authAccessToken");
		let bearerToken = `Bearer ${window.common.auth.accessToken}`;
		if (window.common.auth.accessToken) {
			fetch(`/auth/realms/${window.common.auth.getRealm()}/protocol/openid-connect/userinfo`, {
				headers: { Authorization: bearerToken }
			}).then((res) => {
				if (res.ok) { return res.json(); }
				window.common.auth.__remove_all_auth_data__();
				if (errorHandler) { errorHandler(); }
				throw res
			}).then((userInfo) => {
				window.common.auth.__load_all_auth_data__();
				window.common.auth.username = userInfo.preferred_username;
				window.common.auth.userInfo = userInfo;
				window.common.auth.apiHeaders = {
					"Content-Type": "application/json; charset=utf-8",
					"Accept": "application/json; charset=utf-8",
					"Authorization": bearerToken,
					"Realm": window.common.auth.getRealm()
				};
				localStorage.setItem("authUsername", window.common.auth.username);
				localStorage.setItem("authUserInfo", JSON.stringify(window.common.auth.userInfo));
				if (resultHandler) { resultHandler(); }
			})
		} else {
			window.common.auth.__remove_all_auth_data__();
			if (errorHandler) { errorHandler(); }
		}
	}
};

window.common.auth.loginDataService = (resultHandler, errorHandler) => {
	if (DEFAULT_DATA_SERVICE) {
		window.common.auth.dataToken = localStorage.getItem("authDataToken");
		if (window.common.auth.dataToken) {
			if (resultHandler) { resultHandler(); }
		} else {
			fetch("/minio/ui/api/v1/login").then((res) => {
				if (res.ok) { return res.json(); }
				localStorage.removeItem("authDataToken");
				if (errorHandler) { errorHandler(); }
				throw res;
			}).then((data) => {
				fetch(data.redirectRules[0].redirect).then((res) => {
					if (res.ok) { return res.json(); }
					localStorage.removeItem("authDataToken");
					if (errorHandler) { errorHandler(); }
					throw res;
				}).then((data) => {
					data.state = decodeURIComponent(data.state);
					fetch("/minio/ui/api/v1/login/oauth2/auth", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(data)
					}).then((res) => {
						if (res.ok) {
							fetch("/minio/ui/cookie_to_data").then((res) => {
								if (res.ok) { return res.json(); }
								localStorage.removeItem("authDataToken");
								if (errorHandler) { errorHandler(); }
								throw res;
							}).then((data) => {
								localStorage.setItem("authDataToken", data.token);
								if (resultHandler) { resultHandler(); }
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
		if (resultHandler) { resultHandler(); }
	}
};

window.common.auth.refreshDataService = (resultHandler, errorHandler) => {
	localStorage.removeItem("authDataToken");
	window.common.auth.loginDataService(resultHandler, errorHandler);
};

window.common.auth.loginTermService = (resultHandler, errorHandler) => {
	if (DEFAULT_TERM_SERVICE) {
		window.common.auth.termToken = localStorage.getItem("authTermToken");
		if (window.common.auth.termToken) {
			fetch(`/guacamole/api/session/data/postgresql/users/${window.common.auth.username}`, {
				headers: { "Guacamole-Token": window.common.auth.termToken }
			}).then((res) => {
				if (res.ok) {
					if (resultHandler) { resultHandler(); }
				} else {
					localStorage.removeItem("authTermToken");
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
			}).then((res) => {
				if (res.ok) { return res.json(); }
				localStorage.removeItem("authTermToken");
				if (errorHandler) { errorHandler(); }
				throw res;
			}).then((guacamole) => {
				localStorage.setItem("GUAC_AUTH", JSON.stringify(guacamole));
				localStorage.setItem("authTermToken", guacamole.authToken);
				window.location.replace("/");
			});
		} else { window.location.replace("/guacamole/api/ext/openid/login"); }
	} else {
		if (resultHandler) { resultHandler(); }
	}
};

window.common.auth.refreshTermService = (resultHandler, errorHandler) => {
	localStorage.removeItem("authTermToken");
	window.common.auth.loginTermService(resultHandler, errorHandler);
};

window.common.auth.login = (resultHandler, errorHandler) => {
	if (resultHandler) { window.common.auth.loginResultHandler = resultHandler; }
	else { resultHandler = window.common.auth.loginResultHandler; }
	if (errorHandler) { window.common.auth.loginErrorHandler = errorHandler; }
	else { errorHandler = window.common.auth.loginErrorHandler; }

	function check_authorization(resultHandler, errorHandler) {
		window.common.auth.checkUserInfo(() => {
			window.common.auth.loginDataService(resultHandler, errorHandler);
		}, () => {
			window.common.auth.keycloak = new Keycloak({
				url: DEFAULT_AUTH_URL,
				realm: window.common.auth.getRealm(),
				clientId: DEFAULT_AUTH_CLIENT_ID
			});
			window.common.auth.keycloak.onAuthSuccess = () => {
				localStorage.setItem("authAccessToken", window.common.auth.keycloak.token);
				localStorage.setItem("authRefreshToken", window.common.auth.keycloak.refreshToken);
				localStorage.setItem("authIdToken", window.common.auth.keycloak.idToken);
				window.common.auth.checkUserInfo(() => {
					window.common.auth.loginDataService(resultHandler, errorHandler);
				}, errorHandler);
			};
			window.common.auth.keycloak.onAuthError = () => {
				window.common.auth.__remove_all_auth_data__();
				if (errorHandler) { errorHandler(); }
			};
			window.common.auth.keycloak.init({
				onLoad: 'login-required'
			});
		});
	};

	check_authorization(resultHandler, errorHandler);
};

window.common.auth.logout = () => {
	let idToken = window.common.auth.idToken;
	window.common.auth.__remove_all_auth_data__();
	if (idToken) {
		window.location.replace(`/auth/realms/${window.common.auth.getRealm()}/protocol/openid-connect/logout?id_token_hint=${idToken}&post_logout_redirect_uri=/`);
	} else {
		window.location.replace("/");
	}
}

// REST
window.common.rest = {};

window.common.rest.get = (url, resultHandler, errorHandler) => {
	fetch(url, {
		headers: window.common.auth.apiHeaders
	}).then((res) => {
		if (res.ok) { return res.json(); }
		if (errorHandler) { errorHandler(res); }
		throw res
	}).then((data) => {
		if (resultHandler) { resultHandler(data); }
	});
};

window.common.rest.post = (url, data, resultHandler, errorHandler) => {
	fetch(url, {
		method: "POST",
		headers: window.common.auth.apiHeaders,
		body: JSON.stringify(data)
	}).then((res) => {
		if (res.ok) { return res.json(); }
		if (errorHandler) { errorHandler(res); }
		throw res
	}).then((data) => {
		if (resultHandler) { resultHandler(data); }
	});
};

window.common.rest.put = (url, data, resultHandler, errorHandler) => {
	fetch(url, {
		method: "PUT",
		headers: window.common.auth.apiHeaders,
		body: JSON.stringify(data)
	}).then((res) => {
		if (res.ok) { return res.json(); }
		if (errorHandler) { errorHandler(res); }
		throw res
	}).then((data) => {
		if (resultHandler) { resultHandler(data); }
	});
};

window.common.rest.delete = (url, resultHandler, errorHandler) => {
	fetch(url, {
		method: "DELETE",
		headers: window.common.auth.apiHeaders
	}).then((res) => {
		if (res.ok) { return res.json(); }
		if (errorHandler) { errorHandler(res); }
		throw res
	}).then((data) => {
		if (resultHandler) { resultHandler(data); }
	});
};

// WEBSOCKET
window.common.wsock = {};

window.common.wsock.connect = (url, recvHandler, openHandler, closeHandler, errorHandler) => {
	let socket = null;
	try {
		socket = new WebSocket(`wss://${DEFAULT_ENDPOINT}${url}?org=${window.common.auth.realm}&token=${window.common.auth.accessToken}`);
	} catch (e) {
		if (errorHandler) { errorHandler(e); }
		throw e
	}
	socket.onmessage = (event) => {
		console.log("ws:recv");
		if (recvHandler) { recvHandler(JSON.parse(event.data)); }
	};
	socket.onopen = (event) => {
		console.log("ws:open");
		if (openHandler) { openHandler(event); }
	};
	socket.onclose = (event) => {
		console.log("ws:close");
		if (closeHandler) { closeHandler(event); }
	};
	socket.onerror = (event) => {
		console.log("ws:error");
		if (errorHandler) { errorHandler(event); }
	};
	return socket;
};

// DATA
window.common.data = {};

window.common.data._set_object_functions_ = (bucket, object) => {
	if (object.etag !== undefined) {
		object.isData = () => { return true; };
		object.isDir = () => { return false; };
		object.getUrl = () => {
			return `/minio/ui/api/v1/buckets/${bucket}/objects/download?prefix=${btoa(object.name)}`
		};
		object.getBlob = (resultHandler, errorHandler) => {
			fetch(object.getUrl()).then((res) => {
				if (res.ok) { return res.blob(); }
				if (errorHandler) { errorHandler(res); }
				throw res;
			}).then((data) => {
				if (resultHandler) { resultHandler(data); }
			});
		};
	} else {
		object.isData = () => { return false; };
		object.isDir = () => { return true; };
		object.getObjectList = (resultHandler, errorHandler) => {
			fetch(`/minio/ui/api/v1/buckets/${bucket}/objects?prefix=${btoa(object.name)}`).then((res) => {
				if (res.ok) { return res.json(); }
				if (errorHandler) { errorHandler(res); }
				throw res;
			}).then((data) => {
				let objects = data.objects ? data.objects : [];
				objects.forEach((object) => { window.common.data._set_object_functions_(bucket, object); });
				if (resultHandler) { resultHandler(objects); }
			});
		};
	}
};

window.common.data.getBucketList = (resultHandler, errorHandler) => {
	fetch("/minio/ui/api/v1/buckets").then((res) => {
		if (res.ok) { return res.json(); }
		if (errorHandler) { errorHandler(res); }
		throw res;
	}).then((data) => {
		let buckets = data.buckets;
		buckets.forEach((object) => {
			object.isData = () => { return false; };
			object.isDir = () => { return true; };
			object.getObjectList = (resultHandler, errorHandler) => {
				fetch(`/minio/ui/api/v1/buckets/${object.name}/objects`).then((res) => {
					if (res.ok) { return res.json(); }
					if (errorHandler) { errorHandler(res); }
					throw res;
				}).then((data) => {
					let objects = data.objects ? data.objects : [];
					objects.forEach((object) => { window.common.data._set_object_functions_(object.name, object); });
					if (resultHandler) { resultHandler(objects); }
				});
			}
		});
		if (resultHandler) { resultHandler(buckets); }
	});
};

window.common.data.getObjectList = (bucket, path, resultHandler, errorHandler) => {
	let prefix = "";
	if (!(path === undefined || path == null || path == '/')) {
		let paths = path.split("/").filter((item) => {
			if (item) return true;
			else return false;
		});
		path = `${paths.join("/")}/`
		prefix = `prefix=${btoa(path)}`;
	}
	fetch(`/minio/ui/api/v1/buckets/${bucket}/objects?${prefix}`).then((res) => {
		if (res.ok) { return res.json(); }
		if (errorHandler) { errorHandler(res); }
		throw res;
	}).then((data) => {
		let objects = data.objects ? data.objects : [];
		objects.forEach((object) => { window.common.data._set_object_functions_(bucket, object); });
		if (resultHandler) { resultHandler(objects); }
	});
};

window.common.data.getObject = (bucket, path, resultHandler, errorHandler) => {
	if (path === undefined || path == null || path == '/') { throw "path is required"; }
	path = path.split("/").filter((item) => { return item; }).join("/");
	fetch(`/minio/ui/api/v1/buckets/${bucket}/objects?prefix=${btoa(path)}`).then((res) => {
		if (res.ok) { return res.json(); }
		if (errorHandler) { errorHandler(res); }
		throw res;
	}).then((data) => {
		if (!(data.objects)) { if (errorHandler) { errorHandler(data); } }
		else if (data.objects.length != 1) { if (errorHandler) { errorHandler(data); } }
		else {
			let object = data.objects[0];
			window.common.data._set_object_functions_(bucket, object);
			if (resultHandler) { resultHandler(object); }
		}
	});
};

window.common.data.upload = (bucket, path, files, resultHandler, errorHandler) => {
	if (files.length > 0) {
		let basePath = path.split("/").filter((item) => { return item; }).join("/");
		let coros = [];
		let results = [];
		let isOk = true;

		for (let i = 0; i < files.length; i++) {
			let file = files[i];
			let prefix = basePath ? `${basePath}/${file.name}` : file.name;
			let form = new FormData();
			form.append(file.size, file);
			coros.push(fetch(`/minio/ui/api/v1/buckets/${bucket}/objects/upload?prefix=${btoa(prefix)}`, {
				method: "POST",
				body: form
			}));
			results.push(null);
		}
		for (let i = 0, j = 1; i < files.length; i++, j++) {
			let coro = coros[i];
			coro.then((res) => {
				results[i] = res;
				if (res.ok) {
					if (j == files.length && isOk && resultHandler) {
						resultHandler(bucket, path, files, results);
					}
				} else if (errorHandler) {
					isOk = false
					errorHandler(bucket, path, files, results);
				}
			});
		}
	} else if (errorHandler) {
		errorHandler(bucket, path, files);
	}
};

window.common.data.delete = (bucket, path, resultHandler, errorHandler) => {
	fetch(`/minio/ui/api/v1/buckets/${bucket}/objects?prefix=${btoa(path)}`, {
		method: "DELETE"
	}).then((res) => {
		if (res.ok) {
			if (resultHandler) { resultHandler(bucket, path, res); }
		} else if (errorHandler) { errorHandler(bucket, path, res); }
	});
};

// CONSOLE
window.common.term = {};

window.common.term.openNewWindow = (username, hostname, hostport) => {
	hostport = hostport ? hostport : "22";
	window.open(`/static/html/console.html?username=${username}&hostname=${hostname}&hostport=${hostport}`, "_blank", "menubar=no,status=no,titlebar=no,toolbar=no");
};

window.common.term.openNewTab = (username, hostname, hostport) => {
	hostport = hostport ? hostport : "22";
	window.open(`/static/html/console.html?username=${username}&hostname=${hostname}&hostport=${hostport}`, "_blank");
};

window.common.term.openOnDom = (dom, username, hostname, hostport) => {
	hostport = hostport ? hostport : "22";
	fetch(`/guacamole/api/session/ext/quickconnect/create?token=${window.common.auth.consoleToken}`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: `uri=ssh://${username}@${hostname}:${hostport}`
	}).then((res) => {
		if (res.ok) { return res.json(); }
		throw res;
	}).then((data) => {
		window.common.term.connectToSSH(dom, data.identifier);
	})
};

window.common.term.closeByException = (message) => {
	window.alert(message);
	window.close();
};

window.common.term.connectToSSH = (dom, id) => {
	let guac = new Guacamole.Client(new Guacamole.WebSocketTunnel('/guacamole/websocket-tunnel'));
	let guacDisp = guac.getDisplay().getElement();
	dom.appendChild(guacDisp);

	let options = `token=${window.common.auth.consoleToken}&GUAC_ID=${id}&GUAC_DATA_SOURCE=quickconnect&GUAC_TYPE=c`;
	options += `&GUAC_WIDTH=${Math.round(window.innerWidth)}&GUAC_HEIGHT=${Math.round(window.innerHeight)}&GUAC_DPI=96`;
	options += "&GUAC_AUDIO=audio/L8&GUAC_AUDIO=audio/L16&GUAC_IMAGE=image/jpeg&GUAC_IMAGE=image/png&GUAC_IMAGE=image/webp&GUAC_TIMEZONE=Asia/Seoul";

	guac.connect(options);
	guac.onerror = (error) => {
		console.error(error);
		window.common.term.closeByException("문제가 발생하여 연결하지 못했습니다");
	};
	guac.onstatechange = (state) => {
		switch (state) {
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
	guac.onclipboard = (stream, mimetype) => {
		if (mimetype == "text/plain") {
			let reader = new Guacamole.StringReader(stream);
			reader.ontext = (data) => { navigator.clipboard.writeText(data); };
		}
	};
	window.onauxclick = () => {
		navigator.clipboard.readText().then((data) => {
			let stream = guac.createClipboardStream("text/plain");
			let writer = new Guacamole.StringWriter(stream);
			writer.sendText(data);
			writer.sendEnd();
		});
	};
	window.onresize = () => guac.sendSize(Math.round(window.innerWidth), Math.round(window.innerHeight));
	window.onunload = () => guac.disconnect();
	window.onclose = () => guac.disconnect();

	let guacMouse = new Guacamole.Mouse(guacDisp);
	guacMouse.onmousedown = (state) => guac.sendMouseState(state);
	guacMouse.onmouseup = (state) => guac.sendMouseState(state);
	guacMouse.onmousemove = (state) => guac.sendMouseState(state);

	let guacKbd = new Guacamole.Keyboard(document);
	guacKbd.onkeydown = (k) => guac.sendKeyEvent(1, k);
	guacKbd.onkeyup = (k) => guac.sendKeyEvent(0, k);
};
