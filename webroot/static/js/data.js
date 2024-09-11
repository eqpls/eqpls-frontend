window.module = window.module || {};
window.module.data = window.module.data || {
	init: () => {
		window.module.data.isAutoLogin = true;
		console.log("(module.data) start");
		window.module.data.login = () => {
			fetch("/objstore/api/v1/login").then((res) => {
				if (res.ok) { return res.json(); }
				throw res;
			}).then((data) => {
				fetch(data.redirectRules[0].redirect).then((res) => {
					if (res.ok) { return res.json(); }
					throw res;
				}).then((data) => {
					data.state = decodeURIComponent(data.state);
					fetch("/objstore/api/v1/login/oauth2/auth", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(data)
					}).then((res) => {
						if (res.ok) {
							window.module.data.getBuckets = async () => {
								return fetch("/objstore/api/v1/buckets").then((res) => {
									if (res.ok) { return res.json(); }
									throw res;
								}).then((data) => {
									let result = [];
									data.buckets.forEach((content) => {
										let sname = content.name.split(".");
										content.owner = sname[0];
										content.displayName = sname[1];
										content.personal = content.owner == window.common.auth.username ? true : false;
										result.push(new Bucket(content));
									});
									return window.common.util.setArrayFunctions(result, Bucket);
								});
							};
							window.module.data.getAccessKeys = async () => {
								return fetch("/objstore/api/v1/service-accounts").then((res) => {
									if (res.ok) { return res.json(); }
									throw res;
								}).then((data) => {
									console.log(data);
									let result = [];
									data.forEach((content) => {
										content.policy = content.policy || "";
										content.expiry = content.expiry || null;
										content.status = content.accountStatus;
										result.push(new AccessKey(content));
									});
									return window.common.util.setArrayFunctions(result, Bucket);
								});
							};
							window.module.data.createAccessKey = async (name, description, policy, expiry, status) => {
								if (!name) { throw "(module.data.createAccessKey) parameter is required"; }
								description = description || "";
								policy = policy || "";
								expiry = expiry || null;
								status = status || "on";
								return fetch("/objstore/api/v1/service-account-credentials", {
									method: "POST",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({
										name: name,
										description: description,
										policy: policy,
										expiry: expiry,
										status: status,
										accessKey: window.common.util.getRandomString(20),
										secretKey: window.common.util.getRandomString(40)
									})
								}).then((res) => {
									if (res.ok) { return res.json(); }
									throw res;
								});
							};
						} else { throw res; }
					});
				});
			});
		};

		function AccessKey(content) {
			if (content) { Object.assign(this, content); }
			this.update = async () => {
				return fetch(`/objstore/api/v1/service-accounts/${common.util.utoa(this.accessKey)}`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						name: this.name,
						description: this.description,
						policy: this.policy,
						expiry: this.expiry,
						status: this.status
					})
				}).then((res) => {
					if (res.ok) {
						return fetch(`/objstore/api/v1/service-accounts/${common.util.utoa(this.accessKey)}`).then((res) => {
							if (res.ok) { return res.json(); }
							throw res;
						}).then((content) => {
							Object.assign(this, content)
						});
					}
					throw res;
				});
			};
			this.delete = async () => {
				return fetch(`/objstore/api/v1/buckets/${this.bucket.name}/objects?prefix=${common.util.utoa(this.name)}`, {
					method: "DELETE"
				}).then((res) => {
					if (res.ok) { return true; }
					throw res;
				});
			};
		};

		function Bucket(content) {
			if (content) { Object.assign(this, content); }
			this.getNodes = async () => {
				return fetch(`/objstore/api/v1/buckets/${this.name}/objects`).then((res) => {
					if (res.ok) { return res.json(); }
					throw res;
				}).then((data) => {
					let folders = [];
					let files = [];
					if (data.objects) {
						data.objects.forEach((content) => {
							content.bucket = this;
							content.parent = this;
							if (content.etag) { files.push(new File(content)); }
							else { folders.push(new Folder(content)); }
						});
					}
					return {
						folders: window.common.util.setArrayFunctions(folders, Folder),
						files: window.common.util.setArrayFunctions(files, File)
					};
				});
			};
			this.upload = async (files) => {
				let results = [];
				if (files.length > 0) {
					let coros = [];
					for (let i = 0; i < files.length; i++) {
						let file = files[i];
						let form = new FormData();
						form.append(file.size, file);
						coros.push(fetch(`/objstore/api/v1/buckets/${this.bucket.name}/objects/upload?prefix=${common.util.utoa(file.name)}`, {
							method: "POST",
							body: form
						}));
						results.push(null);
					}
					for (let i = 0, j = 1; i < files.length; i++, j++) {
						let coro = coros[i];
						coro.then((res) => { results[i] = res; });
					}
				}
				return results;
			};
			this.print = () => { console.log(this); };
		};

		function Folder(content) {
			if (content) { Object.assign(this, content); }
			this.getNodes = async () => {
				return fetch(`/objstore/api/v1/buckets/${this.bucket.name}/objects?prefix=${common.util.utoa(this.name)}`).then((res) => {
					if (res.ok) { return res.json(); }
					throw res;
				}).then((data) => {
					let folders = [];
					let files = [];
					if (data.objects) {
						data.objects.forEach((content) => {
							content.bucket = this.bucket;
							content.parent = this;
							if (content.etag) { files.push(new File(content)); }
							else { folders.push(new Folder(content)); }
						});
					}
					return {
						folders: window.common.util.setArrayFunctions(folders, Folder),
						files: window.common.util.setArrayFunctions(files, File)
					};
				});
			};
			this.getParent = async () => { return this.parent; };
			this.createFolder = async (name) => {
				return new Folder({
					last_modified: "",
					name: `${this.name}${name}/`,
					bucket: this.bucket
				});
			};
			this.upload = async (files) => {
				let results = [];
				if (files.length > 0) {
					let coros = [];
					for (let i = 0; i < files.length; i++) {
						let file = files[i];
						let prefix = `${this.name}${file.name}`;
						let form = new FormData();
						form.append(file.size, file);
						coros.push(fetch(`/objstore/api/v1/buckets/${this.bucket.name}/objects/upload?prefix=${common.util.utoa(prefix)}`, {
							method: "POST",
							body: form
						}));
						results.push(null);
					}
					for (let i = 0, j = 1; i < files.length; i++, j++) {
						let coro = coros[i];
						coro.then((res) => { results[i] = res; });
					}
				}
				return results;
			};
			this.delete = async () => {
				return fetch(`/objstore/api/v1/buckets/${this.bucket.name}/objects?prefix=${common.util.utoa(this.name)}&recursive=true`, {
					method: "DELETE"
				}).then((res) => {
					if (res.ok) { return true; }
					throw res;
				});
			};
			this.print = () => { console.log(this); };
		};

		function File(content) {
			if (content) { Object.assign(this, content); }
			this.getParent = async () => { return this.parent; };
			this.read = async () => {
				return fetch(`/objstore/api/v1/buckets/${this.bucket.name}/objects/download?prefix=${common.util.utoa(this.name)}`).then((res) => {
					if (res.ok) { return res.blob(); }
					throw res;
				});
			};
			this.download = async () => {
				let blob = await this.read();
				let dom = document.createElement("a");
				let url = URL.createObjectURL(blob);
				let fileName = this.name.split("/");
				dom.href = url;
				dom.download = fileName[fileName.length - 1];
				dom.click();
				dom.remove();
				URL.revokeObjectURL(url);
			};
			this.delete = async () => {
				return fetch(`/objstore/api/v1/buckets/${this.bucket.name}/objects?prefix=${common.util.utoa(this.name)}`, {
					method: "DELETE"
				}).then((res) => {
					if (res.ok) { return true; }
					throw res;
				});
			};
			this.print = () => { console.log(this); };
		};

		console.log("(module.data) ready");
	}
};
