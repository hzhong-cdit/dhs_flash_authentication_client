const Hapi = require('hapi'),
	AuthClient = require('./lib');

const server = new Hapi.Server();
		server.connection({ port: 3000 });

		server.register({ register: AuthClient }, (err) => {
			//expect(err).not.toBeDefined();
			if (err) {
				console.log('Error: ', err);
			}
			server.route({
				method: 'GET',
				path: '/restricted',
				config: {
					auth: 'jwt'
				},
				handler: function(request, reply) {
					reply({ success: true })
					          .header("Authorization", request.headers.authorization);
				}
			});
		});

		server.start((err) => {
			//expect(err).not.toBeDefined();
			if (err) {
				console.log('Error during server start', err);
			}

			console.log('Server started at ', server.info.uri);
		});