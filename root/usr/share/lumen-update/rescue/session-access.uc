#!/usr/bin/ucode
'use strict';
import { connect } from 'ubus';

/* Preserve only permissions a live session already has for the normal updater.
 * New logins get the equivalent permissions from the retained ACL file. */
let bus = connect();
if (!bus) exit(1);
let sessions = bus.call('session', 'list', {}, true);
if (type(sessions) != 'array') exit(1);

function access(sid, scope, object, method) {
	let result = bus.call('session', 'access', {
		ubus_rpc_session: sid, scope: scope, object: object, function: method
	});
	return result && result.access === true;
}

function carry(sid, scope, original, retained, methods) {
	for (let method in methods) {
		if (!access(sid, scope, original, method) || access(sid, scope, retained, method))
			continue;
		bus.call('session', 'grant', {
			ubus_rpc_session: sid, scope: scope, objects: [[retained, method]]
		});
		if (!access(sid, scope, retained, method)) return false;
	}
	return true;
}

for (let session in sessions) {
	let sid = session && session.ubus_rpc_session;
	if (type(sid) != 'string' || !match(sid, /^[0-9a-f]{32}$/)) continue;
	if (!carry(sid, 'access-group', 'luci-theme-lumen-updater', 'luci-app-lumen-rescue', ['read', 'write']) ||
	    !carry(sid, 'ubus', 'lumen.update', 'lumen.recovery', ['status', 'start', 'confirm']))
		exit(1);
}
