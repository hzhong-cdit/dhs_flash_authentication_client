const Config = require('../config/config'),
	Boom = require('boom'),
	Seneca = require('seneca')();

exports.register = function(server, options, next) {

	server.auth.scheme('jwt', scheme);

	server.auth.strategy('jwt', 'jwt', {
		key: Config.AuthServer.secret
	})
	next();
}

exports.register.attributes = {
	pkg: require('../package.json')
}

const scheme = function(server, options) {
	return {
		authenticate: function(request, reply) {
			var authorization = request.headers.authorization;
			if (!authorization) {
				return reply(Boom.unauthorized('Could not authenticate request'));
			}

			var refToken = authorization.refToken;

			if (!refToken) {
				return reply(Boom.unauthorized('Could not authenticate request'));
			}

			Seneca.client({
				type: 'http',
				port: Config.AuthServer.senecaPort,
				host: Config.AuthServer.host,
				pin: Config.AuthServer.pins.validate
			}).act({
				referenceToken: refToken
			}, (err, result) => {
				if (err) {
					return reply(Boom.unauthorized('Could not authenticate request'));
				}
				console.log("Response from Auth Server: ", result);
				reply.continue({ credentials: result });
			});
		}
	}
}