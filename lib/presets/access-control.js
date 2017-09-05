'use strict';Object.defineProperty(exports,'__esModule',{value:true});var _slicedToArray=function(){function sliceIterator(arr,i){var _arr=[];var _n=true;var _d=false;var _e=undefined;try{for(var _i=arr[Symbol.iterator](),_s;!(_n=(_s=_i.next()).done);_n=true){_arr.push(_s.value);if(i&&_arr.length===i)break}}catch(err){_d=true;_e=err}finally{try{if(!_n&&_i['return'])_i['return']()}finally{if(_d)throw _e}}return _arr}return function(arr,i){if(Array.isArray(arr)){return arr}else if(Symbol.iterator in Object(arr)){return sliceIterator(arr,i)}else{throw new TypeError('Invalid attempt to destructure non-iterable instance')}}}();var _fs=require('fs');var _fs2=_interopRequireDefault(_fs);var _os=require('os');var _os2=_interopRequireDefault(_os);var _net=require('net');var _net2=_interopRequireDefault(_net);var _path=require('path');var _path2=_interopRequireDefault(_path);var _readline=require('readline');var _readline2=_interopRequireDefault(_readline);var _ip=require('ip');var _ip2=_interopRequireDefault(_ip);var _defs=require('./defs');var _utils=require('../utils');function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj}}let rules=[];let cachedRules={};function ruleIsMatch(host,port){const rHost=this.host,rPort=this.port;const slashIndex=rHost.indexOf('/');let isHostMatch=false;if(slashIndex!==-1){isHostMatch=_ip2.default.cidrSubnet(rHost).contains(host)}else{isHostMatch=rHost===host}if(rHost==='*'||isHostMatch){if(rPort==='*'||port===rPort){return true}}return false}function ruleToString(){return`${this.host}:${this.port} ${this.isBan?1:0} ${this.upLimit} ${this.dlLimit}`}function parseHost(host){const slashIndex=host.indexOf('/');if(slashIndex<0){if(host!=='*'&&!_net2.default.isIP(host)&&!(0,_utils.isValidHostname)(host)){return null}return host}if(slashIndex<7){return null}const parts=host.split('/');const ip=parts[0];const mask=parts[parts.length-1];if(!_net2.default.isIP(ip)){return null}if(mask===''||!Number.isInteger(+mask)||+mask<0||+mask>32){return null}return host}function parseSpeed(speed){const regex=/^(\d+)(b|k|kb|m|mb|g|gb)$/g;const results=regex.exec(speed.toLowerCase());if(results!==null){var _results=_slicedToArray(results,3);const num=_results[1],unit=_results[2];return+num*{'b':1,'k':1024,'kb':1024,'m':1048576,'mb':1048576,'g':1073741824,'gb':1073741824}[unit]}return null}function parseLine(line){if(line.length>300){return null}line=line.trim();if(line.length<1){return null}if(line[0]==='#'){return null}var _line$split$filter=line.split(' ').filter(p=>p.length>0),_line$split$filter2=_slicedToArray(_line$split$filter,4);const addr=_line$split$filter2[0],ban=_line$split$filter2[1],up=_line$split$filter2[2],dl=_line$split$filter2[3];let _host=null;let _port=null;let _isBan=false;let _upLimit='-';let _dlLimit='-';if(addr.indexOf(':')>0){const parts=addr.split(':');const host=parts[0];const port=parts[parts.length-1];_host=parseHost(host);if(port!=='*'){if(!(0,_utils.isValidPort)(+port)){return null}_port=+port}else{_port=port}}else{_host=parseHost(addr);_port='*'}if(_host===null){return null}if(ban!==undefined){if(ban!=='0'&&ban!=='1'){return null}_isBan=ban!=='0'}if(up!==undefined&&up!=='-'){_upLimit=parseSpeed(up);if(!_upLimit){return null}}if(dl!==undefined&&dl!=='-'){_dlLimit=parseSpeed(dl);if(!_dlLimit){return null}}return{host:_host,port:_port,isBan:_isBan,upLimit:_upLimit,dlLimit:_dlLimit,isMatch:ruleIsMatch,toString:ruleToString}}function reloadRules(aclPath){_utils.logger.verbose('[acl] (re)loading access list');const rs=_fs2.default.createReadStream(aclPath,{encoding:'utf-8'});rs.on('error',err=>{_utils.logger.warn(`[acl] fail to reload acl: ${err.message}, keep using previous rules`)});const rl=_readline2.default.createInterface({input:rs});const _rules=[];rl.on('line',line=>{const rule=parseLine(line);if(rule!==null){_rules.push(rule)}});rl.on('close',()=>{rules=_rules.reverse();cachedRules={};_utils.logger.info(`[acl] ${rules.length} rules loaded`)})}function findRule(host,port){const cacheKey=`${host}:${port}`;const cacheRule=cachedRules[cacheKey];if(cacheRule!==undefined){return cacheRule}else{var _iteratorNormalCompletion=true;var _didIteratorError=false;var _iteratorError=undefined;try{for(var _iterator=rules[Symbol.iterator](),_step;!(_iteratorNormalCompletion=(_step=_iterator.next()).done);_iteratorNormalCompletion=true){const rule=_step.value;if(rule.isMatch(host,port)){return cachedRules[cacheKey]=rule}}}catch(err){_didIteratorError=true;_iteratorError=err}finally{try{if(!_iteratorNormalCompletion&&_iterator.return){_iterator.return()}}finally{if(_didIteratorError){throw _iteratorError}}}return cachedRules[cacheKey]=null}}const DEFAULT_MAX_TRIES=60;const tries={};class AccessControlPreset extends _defs.IPreset{static checkParams({acl,max_tries=DEFAULT_MAX_TRIES}){if(typeof acl!=='string'||acl===''){throw Error('\'acl\' must be a non-empty string')}const aclPath=_path2.default.resolve(process.cwd(),acl);if(!_fs2.default.existsSync(aclPath)){throw Error(`"${aclPath}" not found`)}if(max_tries!==undefined){if(typeof max_tries!=='number'||!Number.isInteger(max_tries)){throw Error('\'max_tries\' must be an integer')}if(max_tries<1){throw Error('\'max_tries\' must be greater than 0')}}reloadRules(aclPath);_fs2.default.watchFile(aclPath,(curr,prev)=>{if(curr.mtime>prev.mtime){reloadRules(aclPath)}})}constructor({acl,max_tries=DEFAULT_MAX_TRIES}){super();this._aclPath='';this._maxTries=0;this._hrTimeBegin=process.hrtime();this._remoteHost=null;this._remotePort=null;this._dstHost=null;this._dstPort=null;this._totalOut=0;this._totalIn=0;this._isBlocking=false;this._isDlPaused=false;this._isUpPaused=false;this._aclPath=_path2.default.resolve(process.cwd(),acl);this._maxTries=max_tries}applyRule(rule){const host=rule.host,port=rule.port,isBan=rule.isBan,upLimit=rule.upLimit,dlLimit=rule.dlLimit;_utils.logger.debug(`[acl] [${this._remoteHost}:${this._remotePort}] apply rule: "${rule}"`);if(isBan){_utils.logger.info(`[acl] [${host}:${port}] baned by rule: "${rule}"`);this.broadcast({type:_defs.PRESET_CLOSE_CONNECTION});this._isBlocking=true}if(upLimit!=='-'){var _process$hrtime=process.hrtime(this._hrTimeBegin),_process$hrtime2=_slicedToArray(_process$hrtime,2);const sec=_process$hrtime2[0],nano=_process$hrtime2[1];const speed=Math.ceil(this._totalIn/(sec+nano/1e9));_utils.logger.debug(`[acl] upload speed: ${speed}b/s`);if(speed>upLimit&&!this._isUpPaused){this._isUpPaused=true;this.broadcast({type:_defs.PRESET_PAUSE_RECV});const timeout=speed/upLimit*1.1;const direction=`[${this._remoteHost}:${this._remotePort}] -> [${this._dstHost}:${this._dstPort}]`;_utils.logger.info(`[acl] ${direction} upload speed exceed: ${speed}b/s > ${upLimit}b/s, pause for ${timeout}s...`);setTimeout(()=>{this.broadcast({type:_defs.PRESET_RESUME_RECV});this._isUpPaused=false},timeout*1e3)}}if(dlLimit!=='-'){var _process$hrtime3=process.hrtime(this._hrTimeBegin),_process$hrtime4=_slicedToArray(_process$hrtime3,2);const sec=_process$hrtime4[0],nano=_process$hrtime4[1];const speed=Math.ceil(this._totalOut/(sec+nano/1e9));_utils.logger.debug(`[acl] download speed: ${speed}b/s`);if(speed>dlLimit&&!this._isDlPaused){this._isDlPaused=true;this.broadcast({type:_defs.PRESET_PAUSE_SEND});const timeout=speed/dlLimit*1.1;const direction=`[${this._remoteHost}:${this._remotePort}] <- [${this._dstHost}:${this._dstPort}]`;_utils.logger.info(`[acl] ${direction} download speed exceed: ${speed}b/s > ${dlLimit}b/s, pause for ${timeout}s...`);setTimeout(()=>{this.broadcast({type:_defs.PRESET_RESUME_SEND});this._isDlPaused=false},timeout*1e3)}}}checkRule(host,port){const rule=findRule(host,port);if(rule!==null){this.applyRule(rule)}}appendToAcl(line){_utils.logger.info(`[acl] append rule: "${line}" to acl`);_fs2.default.appendFile(this._aclPath,`${_os2.default.EOL}${line}`,err=>{if(err){_utils.logger.warn(`[acl] fail to update acl: ${err.message}`)}rules.push(parseLine(line))})}onNotified({type,payload}){switch(type){case _defs.CONNECTION_CREATED:{const host=payload.host,port=payload.port;this._remoteHost=host;this._remotePort=port;this.checkRule(host,port);break}case _defs.CONNECT_TO_REMOTE:{const host=payload.host,port=payload.port;this._dstHost=host;this._dstPort=port;this.checkRule(host,port);break}case _defs.PRESET_FAILED:{const host=this._remoteHost;const maxTries=this._maxTries;if(tries[host]===undefined){tries[host]=0}if(++tries[host]>=maxTries){_utils.logger.warn(`[acl] ${host} max tries(${maxTries}) exceed`);this.broadcast({type:_defs.PRESET_CLOSE_CONNECTION});this._isBlocking=true;if(findRule(host,'*')===null){this.appendToAcl(`${host}:* 1`)}}return}}}beforeOut({buffer}){this._totalOut+=buffer.length;if(this._isBlocking){return}this.checkRule(this._remoteHost,this._remotePort);this.checkRule(this._dstHost,this._dstPort);return buffer}beforeIn({buffer}){this._totalIn+=buffer.length;if(this._isBlocking){return}this.checkRule(this._remoteHost,this._remotePort);this.checkRule(this._dstHost,this._dstPort);return buffer}}exports.default=AccessControlPreset;