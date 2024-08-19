// javascript here

window.common.auth.login(() => {
	document.getElementById("eqpls-access-token").innerText = window.common.auth.accessToken;

	window.common.wsock.connect(
		`/router/websocket?org=${window.common.auth.realm}&token=${window.common.auth.accessToken}`,
		(data) => {
			console.log(data);
		}
	);

	window.common.data.getObject(
		"admin",
		"/equal_flowww.png",
		(object) => {
			object.getBlob((blob) => {
				document.getElementById("eqpls-data-blob").src = URL.createObjectURL(blob);
			});
		}, (error) => {
			console.error(error);
		}
	);

	document.getElementById("eqpls-data-upload").onclick = (event) => {
		event.stopPropagation();

		console.log("upload click");
		let files = document.getElementById("eqpls-data-file").files;
		console.log(files);

		window.common.data.upload(
			"admin",
			"/",
			files,
			(bucket, path, files) => {
				console.log(bucket);
				console.log(path);
				console.log(files);
				//console.log(results);
			}
		);

		/*
		if (files.length > 0) {
			let basePath = "/test1";
			basePath = basePath.split("/").filter((item) => { return item; }).join("/");
			for (let i=0; i<files.length; i++) {
				let file = files[i];
				let path = `${basePath}/${file.name}`;
				let form = new FormData();
				form.append(file.size, file);
				fetch(`/minio/ui/api/v1/buckets/admin/objects/upload?prefix=${btoa(path)}`, {
					method: "POST",
					body: form
				});
			}
		}
		*/

	};

}, () => {
	console.error("login error");
});