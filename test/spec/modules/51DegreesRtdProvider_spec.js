import {
  extractConfig,
  get51DegreesJSURL,
  is51DegreesMetaPresent,
  deepSetNotEmptyValue,
  convert51DegreesDataToOrtb2,
  convert51DegreesLocationToOrtb2,
  convert51DegreesDeviceToOrtb2,
  getBidRequestData,
  fiftyOneDegreesSubmodule,
} from 'modules/51DegreesRtdProvider';
import {mergeDeep} from '../../../src/utils';

const inject51DegreesMeta = () => {
  const meta = document.createElement('meta');
  meta.httpEquiv = 'Delegate-CH';
  meta.content = 'sec-ch-ua-full-version-list https://cloud.51degrees.com; sec-ch-ua-model https://cloud.51degrees.com; sec-ch-ua-platform https://cloud.51degrees.com; sec-ch-ua-platform-version https://cloud.51degrees.com';
  document.head.appendChild(meta);
};

describe('51DegreesRtdProvider', function() {
  const MOCK_IPV4 = '1.2.3.4';
  const MOCK_IPV6 = '51dc:5e20:fd6a:c955:66be:03b4:dfa3:35b2';
  const MOCK_51D_IP_DATA = {
    ip: {
      ip: MOCK_IPV4,
      ipv6: MOCK_IPV6,
    },
  };

  const fiftyOneDegreesDevice = {
    screenpixelswidth: 5120,
    screenpixelsheight: 1440,
    hardwarevendor: 'Apple',
    hardwaremodel: 'Macintosh',
    hardwarename: [
      'Macintosh',
    ],
    platformname: 'macOS',
    platformversion: '14.1.2',
    screeninchesheight: 13.27,
    screenincheswidth: 47.17,
    devicetype: 'Desktop',
    pixelratio: 1,
    deviceid: '17595-131215-132535-18092',
  };

  const fiftyOneDegreesLocation = {
    approximatelocation: {
      latitude: 51.5,
      longitude: -0.14,
    },
    countrycode3: 'gbr',
    regioncode: 'gb',
    town: 'London',
    zipcode: 'SW1A 1AA',
    timezoneoffset: 60,
  };

  const fiftyOneDegreesData = {
    device: fiftyOneDegreesDevice,
    location: fiftyOneDegreesLocation,
    ip: MOCK_51D_IP_DATA.ip,
  };

  const expectedORTB2DeviceResult = {
    device: {
      devicetype: 2,
      make: 'Apple',
      model: 'Macintosh',
      os: 'macOS',
      osv: '14.1.2',
      h: 1440,
      w: 5120,
      ppi: 109,
      pxratio: 1,
      ext: {
        fiftyonedegrees_deviceId: '17595-131215-132535-18092',
      },
    },
  };

  const expectedORTB2LocationResult = {
    device: {
      geo: {
        lat: 51.5,
        lon: -0.14,
        type: 2,
        ipservice: 51,
        country: 'GBR',
        region: 'GB',
        city: 'London',
        zip: 'SW1A 1AA',
        utcoffset: 60,
      },
    },
  };

  const expectedORTB2Result = {};
  mergeDeep(
    expectedORTB2Result,
    expectedORTB2DeviceResult,
    expectedORTB2LocationResult,
    {
      device: {
        ip: MOCK_IPV4,
        ipv6: MOCK_IPV6,
      },
    }
  );

  describe('extractConfig', function() {
    it('returns the resourceKey from the moduleConfig', function() {
      const reqBidsConfigObj = {};
      const moduleConfig = {params: {resourceKey: 'TEST_RESOURCE_KEY'}};
      expect(extractConfig(moduleConfig, reqBidsConfigObj)).to.deep.equal({
        resourceKey: 'TEST_RESOURCE_KEY',
        onPremiseJSUrl: undefined,
      });
    });

    it('returns the onPremiseJSUrl from the moduleConfig', function() {
      const reqBidsConfigObj = {};
      const moduleConfig = {params: {onPremiseJSUrl: 'https://example.com/51Degrees.core.js'}};
      expect(extractConfig(moduleConfig, reqBidsConfigObj)).to.deep.equal({
        onPremiseJSUrl: 'https://example.com/51Degrees.core.js',
        resourceKey: undefined,
      });
    });

    it('throws an error if neither resourceKey nor onPremiseJSUrl is provided', function() {
      const reqBidsConfigObj = {};
      const moduleConfig = {params: {}};
      expect(() => extractConfig(moduleConfig, reqBidsConfigObj)).to.throw();
    });

    it('throws an error if both resourceKey and onPremiseJSUrl are provided', function() {
      const reqBidsConfigObj = {};
      const moduleConfig = {params: {
        resourceKey: 'TEST_RESOURCE_KEY',
        onPremiseJSUrl: 'https://example.com/51Degrees.core.js',
      }};
      expect(() => extractConfig(moduleConfig, reqBidsConfigObj)).to.throw();
    });

    it('throws an error if the resourceKey is equal to "<YOUR_RESOURCE_KEY>" from example', function() {
      const reqBidsConfigObj = {};
      const moduleConfig = {params: {resourceKey: '<YOUR_RESOURCE_KEY>'}};
      expect(() => extractConfig(moduleConfig, reqBidsConfigObj)).to.throw();
    });
  });

  describe('get51DegreesJSURL', function() {
    it('returns the cloud URL if the resourceKey is provided', function() {
      const config = {resourceKey: 'TEST_RESOURCE_KEY'};
      expect(get51DegreesJSURL(config)).to.equal(
        'https://cloud.51degrees.com/api/v4/TEST_RESOURCE_KEY.js'
      );
    });

    it('returns the on-premise URL if the onPremiseJSUrl is provided', function() {
      const config = {onPremiseJSUrl: 'https://example.com/51Degrees.core.js'};
      expect(get51DegreesJSURL(config)).to.equal('https://example.com/51Degrees.core.js');
    });
  });

  describe('is51DegreesMetaPresent', function() {
    let initialHeadInnerHTML;

    before(function() {
      initialHeadInnerHTML = document.head.innerHTML;
    });

    afterEach(function() {
      document.head.innerHTML = initialHeadInnerHTML;
    });

    it('returns true if the 51Degrees meta tag is present', function () {
      inject51DegreesMeta();
      expect(is51DegreesMetaPresent()).to.be.true;
    });

    it('returns false if the 51Degrees meta tag is not present', function() {
      expect(is51DegreesMetaPresent()).to.be.false;
    });

    it('works with multiple meta tags, even if those are not to include any `content`', function() {
      const meta1 = document.createElement('meta');
      meta1.httpEquiv = 'Delegate-CH';
      document.head.appendChild(meta1);

      inject51DegreesMeta();

      const meta2 = document.createElement('meta');
      meta2.httpEquiv = 'Delegate-CH';
      document.head.appendChild(meta2);

      expect(is51DegreesMetaPresent()).to.be.true;
    });
  });

  describe('deepSetNotEmptyValue', function() {
    it('sets value of ORTB2 key if it is not empty', function() {
      const data = {};
      deepSetNotEmptyValue(data, 'TEST_ORTB2_KEY', 'TEST_ORTB2_VALUE');
      expect(data).to.deep.equal({TEST_ORTB2_KEY: 'TEST_ORTB2_VALUE'});
      deepSetNotEmptyValue(data, 'test2.TEST_ORTB2_KEY_2', 'TEST_ORTB2_VALUE_2');
      expect(data.test2).to.deep.equal({TEST_ORTB2_KEY_2: 'TEST_ORTB2_VALUE_2'});
    });

    it('throws an error if the key is empty', function() {
      const data = {};
      expect(() => deepSetNotEmptyValue(data, '', 'TEST_ORTB2_VALUE')).to.throw();
    });

    it('does not set value of ORTB2 key if it is empty', function() {
      const data = {};
      deepSetNotEmptyValue(data, 'TEST_ORTB2_KEY', '');
      deepSetNotEmptyValue(data, 'TEST_ORTB2_KEY', 0);
      deepSetNotEmptyValue(data, 'TEST_ORTB2_KEY', null);
      deepSetNotEmptyValue(data, 'TEST_ORTB2_KEY', undefined);
      deepSetNotEmptyValue(data, 'TEST.TEST_ORTB2_KEY', undefined);
      expect(data).to.deep.equal({});
    });
  });

  describe('convert51DegreesDataToOrtb2', function() {
    it('returns empty object if data is null, undefined or empty', () => {
      expect(convert51DegreesDataToOrtb2(null)).to.deep.equal({});
      expect(convert51DegreesDataToOrtb2(undefined)).to.deep.equal({});
      expect(convert51DegreesDataToOrtb2({})).to.deep.equal({});
    });

    it('sets IP addresses if only IP data is provided', function() {
      const ortb2Result = convert51DegreesDataToOrtb2(MOCK_51D_IP_DATA);
      expect(ortb2Result).to.deep.equal({
        device: {
          ip: MOCK_IPV4,
          ipv6: MOCK_IPV6,
        },
      });
    });

    it('converts all 51Degrees data to ORTB2 format', function() {
      expect(convert51DegreesDataToOrtb2(fiftyOneDegreesData)).to.deep.equal(expectedORTB2Result);
    });
  });

  describe('convert51DegreesLocationToOrtb2', function() {
    it('returns empty object if location data is not provided', function() {
      expect(convert51DegreesLocationToOrtb2()).to.deep.equal({});
    });

    it('returns empty object if location data is empty', function() {
      expect(convert51DegreesLocationToOrtb2({})).to.deep.equal({});
    });

    it('sets geo type and ipservice if any location data is provided', function() {
      expect(convert51DegreesLocationToOrtb2({countrycode3: 'gbr'})).to.deep.equal({
        device: {
          geo: {
            type: 2,
            ipservice: 51,
            country: 'GBR',
          },
        },
      });
    });

    it('should convert countrycode3 and regioncode to uppercase', function() {
      expect(convert51DegreesLocationToOrtb2({
        countrycode3: 'gbr',
        regioncode: 'gb',
      })).to.deep.equal({
        device: {
          geo: {
            type: 2,
            ipservice: 51,
            country: 'GBR',
            region: 'GB',
          },
        },
      });
    });

    it('converts all location data to ORTB2 format', function() {
      expect(
        convert51DegreesLocationToOrtb2(fiftyOneDegreesLocation)
      ).to.deep.equal(expectedORTB2LocationResult);
    });
  });

  describe('convert51DegreesDeviceToOrtb2', function() {
    it('converts 51Degrees device data to ORTB2 format', function() {
      expect(
        convert51DegreesDeviceToOrtb2(fiftyOneDegreesDevice)
      ).to.deep.equal(expectedORTB2DeviceResult);
    });

    it('returns an empty object if the device data is not provided', function() {
      expect(convert51DegreesDeviceToOrtb2()).to.deep.equal({});
    });

    it('does not set the deviceid if it is not provided', function() {
      const device = {...fiftyOneDegreesDevice};
      delete device.deviceid;
      expect(convert51DegreesDeviceToOrtb2(device).device).to.not.have.any.keys('ext');
    });

    it('sets the model to hardwarename if hardwaremodel is not provided', function() {
      const device = {...fiftyOneDegreesDevice};
      delete device.hardwaremodel;
      expect(convert51DegreesDeviceToOrtb2(device).device).to.deep.include({model: 'Macintosh'});
    });

    it('does not set the model if hardwarename is empty', function() {
      const device = {...fiftyOneDegreesDevice};
      delete device.hardwaremodel;
      device.hardwarename = [];
      expect(convert51DegreesDeviceToOrtb2(device).device).to.not.have.any.keys('model');
    });

    it('does not set the ppi if screeninchesheight is not provided', function() {
      const device = {...fiftyOneDegreesDevice};
      delete device.screeninchesheight;
      expect(convert51DegreesDeviceToOrtb2(device).device).to.not.have.any.keys('ppi');
    });
  });

  describe('getBidRequestData', function() {
    let initialHeadInnerHTML;
    let reqBidsConfigObj = {};
    const resetReqBidsConfigObj = () => {
      reqBidsConfigObj = {
        ortb2Fragments: {
          global: {
            device: {},
          },
        },
      };
    };

    before(function() {
      initialHeadInnerHTML = document.head.innerHTML;

      const mockScript = document.createElement('script');
      mockScript.innerHTML = `
      window.fod = {complete: (_callback) => _callback(${JSON.stringify(fiftyOneDegreesData)})};
      `;
      document.head.appendChild(mockScript);
    });

    after(function() {
      document.head.innerHTML = initialHeadInnerHTML;
    });

    beforeEach(function() {
      resetReqBidsConfigObj();
    });

    it('calls the callback even if submodule fails (wrong config)', function() {
      const callback = sinon.spy();
      const moduleConfig = {params: {}};
      getBidRequestData(reqBidsConfigObj, callback, moduleConfig, {});
      expect(callback.calledOnce).to.be.true;
    });

    it('calls the callback even if submodule fails (on-premise, non-working URL)', async function() {
      const callback = sinon.spy();
      const moduleConfig = {params: {onPremiseJSUrl: 'http://localhost:12345/test/51Degrees.core.js'}};

      getBidRequestData(reqBidsConfigObj, callback, moduleConfig, {});
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(callback.calledOnce).to.be.true;
    });

    it('calls the callback even if submodule fails (invalid resource key)', async function() {
      const callback = sinon.spy();
      const moduleConfig = {params: {resourceKey: 'INVALID_RESOURCE_KEY'}};

      getBidRequestData(reqBidsConfigObj, callback, moduleConfig, {});
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(callback.calledOnce).to.be.true;
    });

    it('works with Delegate-CH meta tag', async function() {
      inject51DegreesMeta();
      const callback = sinon.spy();
      const moduleConfig = {params: {resourceKey: 'INVALID_RESOURCE_KEY'}};
      getBidRequestData(reqBidsConfigObj, callback, moduleConfig, {});
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(callback.calledOnce).to.be.true;
    });

    it('has the correct ORTB2 data', async function() {
      const callback = sinon.spy();
      const moduleConfig = {params: {resourceKey: 'INVALID_RESOURCE_KEY'}};
      getBidRequestData(reqBidsConfigObj, callback, moduleConfig, {});
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(callback.calledOnce).to.be.true;
      expect(reqBidsConfigObj.ortb2Fragments.global).to.deep.equal(expectedORTB2Result);
    });
  });

  describe('init', function() {
    it('initialises the 51Degrees RTD provider', function() {
      expect(fiftyOneDegreesSubmodule.init()).to.be.true;
    });
  });
});
