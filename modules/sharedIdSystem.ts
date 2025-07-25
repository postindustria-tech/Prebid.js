/**
 * This module adds SharedId to the User ID module
 * The {@link module:modules/userId} module is required
 * @module modules/sharedIdSystem
 * @requires module:modules/userId
 */

import {parseUrl, buildUrl, triggerPixel, logInfo, hasDeviceAccess, generateUUID} from '../src/utils.js';
import {submodule} from '../src/hook.js';
import {getStorageManager} from '../src/storageManager.js';
import {VENDORLESS_GVLID} from '../src/consentHandler.js';
import {MODULE_TYPE_UID} from '../src/activities/modules.js';
import {domainOverrideToRootDomain} from '../libraries/domainOverrideToRootDomain/index.js';

import type {IdProviderSpec} from "./userId/spec.ts";

export const storage = getStorageManager({moduleType: MODULE_TYPE_UID, moduleName: 'sharedId'});
const COOKIE = 'cookie';
const LOCAL_STORAGE = 'html5';
const OPTOUT_NAME = '_pubcid_optout';
const PUB_COMMON_ID = 'PublisherCommonId';

type SharedIdParams = {
  /**
   * If true, then an id is created automatically if it’s missing.
   * Default is true. If your server has a component that generates the id instead, then this should be set to false
   */
  create?: boolean;
  /**
   * If true, the the expiration time is automatically extended whenever the script is executed even if the id exists already.
   * Default is true. If false, then the id expires from the time it was initially created.
   */
  extend?: boolean;
  /**
   * For publisher server support only. Where to call out to for a server cookie.
   */
  pixelUrl?: string;
  /**
   * The value to use for `inserter` in EIDs.
   */
  inserter?: string;
}

declare module './userId/spec' {
  interface UserId {
    pubcid: string;
  }
  interface ProvidersToId {
    sharedId: 'pubcid';
    pubCommonId: 'pubcid';
  }

  interface ProviderParams {
    sharedId: SharedIdParams;
    pubCommonId: SharedIdParams;
  }

}

/**
 * Read a value either from cookie or local storage
 * @param {string} name Name of the item
 * @param {string} type storage type override
 * @returns {string|null} a string if item exists
 */
function readValue(name, type) {
  if (type === COOKIE) {
    return storage.getCookie(name);
  } else if (type === LOCAL_STORAGE) {
    if (storage.hasLocalStorage()) {
      const expValue = storage.getDataFromLocalStorage(`${name}_exp`);
      if (!expValue) {
        return storage.getDataFromLocalStorage(name);
      } else if ((new Date(expValue)).getTime() - Date.now() > 0) {
        return storage.getDataFromLocalStorage(name)
      }
    }
  }
}

function getIdCallback(pubcid, pixelUrl) {
  return function (callback, getStoredId) {
    if (pixelUrl) {
      queuePixelCallback(pixelUrl, pubcid, () => {
        callback(getStoredId() || pubcid);
      })();
    } else {
      callback(pubcid);
    }
  }
}

function queuePixelCallback(pixelUrl, id = '', callback?) {
  if (!pixelUrl) {
    return;
  }

  // Use pubcid as a cache buster
  const urlInfo = parseUrl(pixelUrl);
  urlInfo.search.id = encodeURIComponent('pubcid:' + id);
  const targetUrl = buildUrl(urlInfo);

  return function () {
    triggerPixel(targetUrl, callback);
  };
}

function hasOptedOut() {
  return !!((storage.cookiesAreEnabled() && readValue(OPTOUT_NAME, COOKIE)) ||
    (storage.hasLocalStorage() && readValue(OPTOUT_NAME, LOCAL_STORAGE)));
}

export const sharedIdSystemSubmodule: IdProviderSpec<'sharedId'> = {
  /**
   * used to link submodule with config
   * @type {string}
   */
  name: 'sharedId',
  aliasName: 'pubCommonId',
  gvlid: VENDORLESS_GVLID as any,
  disclosureURL: 'local://prebid/sharedId-optout.json',

  /**
   * decode the stored id value for passing to bid requests
   */
  decode(value, config) {
    if (hasOptedOut()) {
      logInfo('PubCommonId decode: Has opted-out');
      return undefined;
    }
    logInfo(' Decoded value PubCommonId ' + value);
    const idObj = {'pubcid': value as string};
    return idObj;
  },
  getId: function (config = {} as any, consentData, storedId) {
    if (hasOptedOut()) {
      logInfo('PubCommonId: Has opted-out');
      return;
    }
    if (consentData?.coppa) {
      logInfo('PubCommonId: IDs not provided for coppa requests, exiting PubCommonId');
      return;
    }
    const {params: {create = true, pixelUrl} = {}} = config;
    let newId = storedId;
    if (!newId) {
      try {
        if (typeof window[PUB_COMMON_ID] === 'object') {
          // If the page includes its own pubcid module, then save a copy of id.
          newId = window[PUB_COMMON_ID].getId();
        }
      } catch (e) {
      }

      if (!newId) newId = (create && hasDeviceAccess()) ? generateUUID() : undefined;
    }

    return {id: newId, callback: getIdCallback(newId, pixelUrl)};
  },
  /**
   * performs action to extend an id.  There are generally two ways to extend the expiration time
   * of stored id: using pixelUrl or return the id and let main user id module write it again with
   * the new expiration time.
   *
   * PixelUrl, if defined, should point back to a first party domain endpoint.  On the server
   * side, there is either a plugin, or customized logic to read and write back the pubcid cookie.
   * The extendId function itself should return only the callback, and not the id itself to avoid
   * having the script-side overwriting server-side.  This applies to both pubcid and sharedid.
   *
   * On the other hand, if there is no pixelUrl, then the extendId should return storedId so that
   * its expiration time is updated.
   */
  extendId: function(config = {} as any, consentData, storedId) {
    if (hasOptedOut()) {
      logInfo('PubCommonId: Has opted-out');
      return {id: undefined};
    }
    if (consentData?.coppa) {
      logInfo('PubCommonId: IDs not provided for coppa requests, exiting PubCommonId');
      return;
    }
    const {params: {extend = false, pixelUrl} = {}} = config;

    if (extend) {
      if (pixelUrl) {
        const callback = queuePixelCallback(pixelUrl, storedId as string);
        return {callback: callback};
      } else {
        return {id: storedId};
      }
    }
  },
  domainOverride: domainOverrideToRootDomain(storage, 'sharedId'),
  eids: {
    'pubcid'(values, config) {
      const eid: any = {
        source: 'pubcid.org',
        uids: values.map(id => ({id, atype: 1}))
      }
      if (config?.params?.inserter != null) {
        eid.inserter = config.params.inserter;
      }
      return eid;
    },
  }
};

submodule('userId', sharedIdSystemSubmodule);
