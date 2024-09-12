# Changelog

## [2.2.2](https://github.com/flowcore-io/library-sdk-transformer-core-ts/compare/v2.2.1...v2.2.2) (2024-09-12)


### Bug Fixes

* **transformer-builder:** :bug: get handler now passed on the context to handle event ([4e7d01f](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/4e7d01f182bf6556af980d9753d36dfe9997ad76))

## [2.2.1](https://github.com/flowcore-io/library-sdk-transformer-core-ts/compare/v2.2.0...v2.2.1) (2024-09-12)


### Bug Fixes

* **transformer-builder:** :technologist: made context mandatory ([0f47976](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/0f47976b19517284001c0d4cc20edaeb3b3bb8da))

## [2.2.0](https://github.com/flowcore-io/library-sdk-transformer-core-ts/compare/v2.1.1...v2.2.0) (2024-09-12)


### Features

* **transformer-builder:** :sparkles: added metadata to flowcore event schema ([3854b78](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/3854b785bcf063fd6ca07359a2be4cffb43635ce))


### Bug Fixes

* **transformer-builder:** :bug: set context to be required internally within process event and create empty object of nothing exists in context ([122d155](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/122d1557a56e55db01241659526b05993d613f8b))

## [2.1.1](https://github.com/flowcore-io/library-sdk-transformer-core-ts/compare/v2.1.0...v2.1.1) (2024-09-12)


### Bug Fixes

* **transformer-builder:** :bug: added context type to `onEventType` method ([9c99004](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/9c9900426faa6a10304815703280d02cbff966cd))

## [2.1.0](https://github.com/flowcore-io/library-sdk-transformer-core-ts/compare/v2.0.6...v2.1.0) (2024-09-12)


### Features

* added default parameter to webhook type ([c43357e](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/c43357ea730b238982ab43ad175a98ded8728ab3))
* **transformer-builder:** :sparkles: added a context that can be passed to event handler ([f90aa19](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/f90aa19cc4a9b4c43535d345af509924cc01bac6))

## [2.0.6](https://github.com/flowcore-io/library-sdk-transformer-core-ts/compare/v2.0.5...v2.0.6) (2024-09-10)


### Bug Fixes

* added output types for buildWebhook and buildFilehook ([3581cd7](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/3581cd7fda6e1d9b3dc929b997df93619e47e3d5))

## [2.0.5](https://github.com/flowcore-io/library-sdk-transformer-core-ts/compare/v2.0.4...v2.0.5) (2024-09-10)


### Bug Fixes

* fix import ([15518c8](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/15518c8e03077cf6c91f399842f199b6b1a627f5))

## [2.0.4](https://github.com/flowcore-io/library-sdk-transformer-core-ts/compare/v2.0.3...v2.0.4) (2024-09-10)


### Bug Fixes

* change return of safeParseType ([969ed48](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/969ed48af898366a05bc958bf6278ad139f23b68))
* downgrade typebox to same version as in elysia ([634f6c8](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/634f6c8f921cd8cc47c8e0b9919790f15aade96d))

## [2.0.3](https://github.com/flowcore-io/library-sdk-transformer-core-ts/compare/v2.0.2...v2.0.3) (2024-09-10)


### Bug Fixes

* add dependency override for typebox ([ae4eb8d](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/ae4eb8d57ce8b8bd5e25ed06498d4af7692965b6))
* update lock file ([17bfb1d](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/17bfb1d0f61e5cc9b1497e58c98c8cabd0cb2a9f))

## [2.0.2](https://github.com/flowcore-io/library-sdk-transformer-core-ts/compare/v2.0.1...v2.0.2) (2024-09-08)


### Bug Fixes

* add local transform ([1918f39](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/1918f39b1a8eb5185e526909e2c98b575b9a6a5c))
* add secret option to local transformer ([debdd44](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/debdd44b64e7a3d06f1a4219cd8b18882bba12e6))

## [2.0.1](https://github.com/flowcore-io/library-sdk-transformer-core-ts/compare/v2.0.0...v2.0.1) (2024-09-07)


### Bug Fixes

* fix signature of transformer handler methods ([4efbaa7](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/4efbaa71b3a9e81f47daea88562df3fc491f48c2))
* reverse arguments on transformer handler ([29d37b2](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/29d37b232692d7eef591a3c193221ba4c23d48af))

## [2.0.0](https://github.com/flowcore-io/library-sdk-transformer-core-ts/compare/v1.10.1...v2.0.0) (2024-09-06)


### ⚠ BREAKING CHANGES

* update readme

### Features

* add transformer builder ([3caedb4](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/3caedb4b7b1aba852eb8cc8adc737c0462f5b723))
* add webhook builder + linting ([1b2b53f](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/1b2b53f87e9ae93fb687856dfc37edd68326e566))
* update readme ([2c4f391](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/2c4f391cde7f86382effcec7d8e16764c76870e0))


### Bug Fixes

* add missing export ([f180258](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/f1802588e46c6b06b21e6b7a247c7796c18f03a2))
* lint ([5bf5db3](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/5bf5db3c745ca48e9dc76b9acb4eac5c7ee26814))
* remove console log ([9613f87](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/9613f87377bc62b05a586b1f29588fb2dfdc7b4f))

## [1.10.1](https://github.com/flowcore-io/library-sdk-transformer-core-ts/compare/v1.10.0...v1.10.1) (2024-09-03)


### Bug Fixes

* :bug: Corrected failing fetch requests ([f6f1589](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/f6f15898ada26c49632318e444a08c3ccfe4bbc6))
* replaced axios with fetch, to make it bun compatible ([76d649e](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/76d649ee8f5626cc5e12f00a2938c121ff0a2d77))

## [1.10.0](https://github.com/flowcore-io/library-sdk-transformer-core-ts/compare/v1.9.2...v1.10.0) (2024-08-28)


### Features

* add webhook batch factory + skip webhook option on local transformer ([992e954](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/992e9540f61c8706ac0cdcf4b42aab8b02a5d4df))
* move send and sendBatch into the same factory ([53e5881](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/53e5881c64e04748dddf3d3a9609ba74631f215d))

## [1.9.2](https://github.com/flowcore-io/library-sdk-transformer-core-ts/compare/v1.9.1...v1.9.2) (2024-08-22)


### Bug Fixes

* output legitimate error when success is false, for better context ([9bca416](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/9bca4169a09a5b45859c70f20f42fc8980ae93ba))

## [1.9.1](https://github.com/flowcore-io/library-sdk-transformer-core-ts/compare/v1.9.0...v1.9.1) (2024-07-23)


### Bug Fixes

* improved error clarity ([3d7e212](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/3d7e2126edab4daea4edd2849d687df639eb8e21))

## [1.9.0](https://github.com/flowcore-io/library-sdk-transformer-core-ts/compare/v1.8.0...v1.9.0) (2024-06-28)


### Features

* Add metadata field to EventDto ([478294c](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/478294c51d606260093e35ab20f6d6e9d374d9ae))
* Add metadata field to EventDto ([336d208](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/336d208ac32feaacb363a96bba40381b5be47466))

## [1.8.0](https://github.com/flowcore-io/library-sdk-transformer-core-ts/compare/v1.7.1...v1.8.0) (2024-06-21)


### Features

* Add constants file for time bucket format ([e10059a](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/e10059a248b8457b4fa93420cf8163ff283e7c43))

## [1.7.1](https://github.com/flowcore-io/library-sdk-transformer-core-ts/compare/v1.7.0...v1.7.1) (2024-06-18)


### Bug Fixes

* fixes ([ceaf6cd](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/ceaf6cda1288f60aa40e25fa7854c0b88fa61788))

## [1.7.0](https://github.com/flowcore-io/library-sdk-transformer-core-ts/compare/v1.6.2...v1.7.0) (2024-06-18)


### Features

* add retry mechanism to webhook ([6cf4480](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/6cf44808e7a836357262396be696f50445dd40e6))


### Bug Fixes

* refactor ([0785234](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/078523428828d292a37710288a748b27cd7a2f7d))
* refactor options ([59427d0](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/59427d0985b1c10ee7bdbca285fee7d0b3f8a329))

## [1.6.2](https://github.com/flowcore-io/library-sdk-transformer-core-ts/compare/v1.6.1...v1.6.2) (2024-06-18)


### Bug Fixes

* fix imports ([9c6bf90](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/9c6bf90070f1d0851d8a8e8c7da3f0cbdf9f988f))

## [1.6.1](https://github.com/flowcore-io/library-sdk-transformer-core-ts/compare/v1.6.0...v1.6.1) (2024-06-18)


### Bug Fixes

* Add more info to exceptions thrown ([384903a](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/384903a4f1a111c126670e8970d8bbd47e3b4a52))
* remove log ([e8ee6b2](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/e8ee6b272af772fb5ddb8d139f30d1628c93af3b))
* set event ([31f36ce](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/31f36cee58e798e752a1ed22d9d59f34125787c3))

## [1.6.0](https://github.com/flowcore-io/library-sdk-transformer-core-ts/compare/v1.5.0...v1.6.0) (2024-06-12)


### Features

* refactor to not depend on env vars ([41afbc0](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/41afbc0f7939e48976c936db56ad1e6dfd449f9c))

## [1.5.0](https://github.com/flowcore-io/library-sdk-transformer-core-ts/compare/v1.4.0...v1.5.0) (2024-06-12)


### Features

* Add metadata-webhook.factory for handling metadata in webhooks ([41dfad8](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/41dfad8da58661b8a71674f8699f1fe0d6a92f8e))

## [1.4.0](https://github.com/flowcore-io/library-sdk-transformer-core-ts/compare/v1.3.2...v1.4.0) (2024-06-11)


### Features

* add specific exceptions ([658cfd6](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/658cfd6be3b42cad1237ec3d340125e3f8157e79))

## [1.3.2](https://github.com/flowcore-io/library-sdk-transformer-core-ts/compare/v1.3.1...v1.3.2) (2024-06-04)


### Bug Fixes

* Update webhook options to include metadata parameter ([c115cb5](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/c115cb50365a20c2f86194ac9e849597db40c2ed))

## [1.3.1](https://github.com/flowcore-io/library-sdk-transformer-core-ts/compare/v1.3.0...v1.3.1) (2024-06-03)


### Bug Fixes

* Update filehook and webhook options to make times and delay parameters optional ([a965367](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/a965367b7f584bf625cb35552984e92a754edd5f))

## [1.3.0](https://github.com/flowcore-io/library-sdk-transformer-core-ts/compare/v1.2.0...v1.3.0) (2024-06-03)


### Features

* Add optional metadata parameter to sendWebhook function ([f35adb9](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/f35adb9b537d9d568f2f0e7d25d381e18ccc2f62))
* Update sendWebhook function to include optional metadata parameter ([f888f00](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/f888f00cbe143e5d21cd7fb237dc1d9e65dad203))

## [1.2.0](https://github.com/flowcore-io/library-sdk-transformer-core-ts/compare/v1.1.0...v1.2.0) (2024-06-03)


### Features

* Add metadata parameter to sendWebhook function ([b7ae3f3](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/b7ae3f3e30504eb2a28aded481e2485b2d184d44))

## [1.1.0](https://github.com/flowcore-io/library-sdk-transformer-core-ts/compare/v1.0.1...v1.1.0) (2024-05-29)


### Features

* Add optional metadata parameter to sendWebhook function ([90be705](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/90be7058273e8dc2e3cb7d36d062b96bc572dc57))
* Encode metadata as base64 in sendWebhook function ([2deec11](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/2deec11f01c901a09b39db45a045bc948e3b2100))


### Bug Fixes

* bumped build ([633edae](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/633edae79ad14678de81addbec9538d48ac4de64))

## [1.1.0](https://github.com/flowcore-io/library-sdk-transformer-core-ts/compare/v1.0.1...v1.1.0) (2024-05-29)



### Features

* Add optional metadata parameter to sendWebhook function ([90be705](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/90be7058273e8dc2e3cb7d36d062b96bc572dc57))
* Encode metadata as base64 in sendWebhook function ([2deec11](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/2deec11f01c901a09b39db45a045bc948e3b2100))

## [1.0.1](https://github.com/flowcore-io/library-sdk-transformer-core-ts/compare/v1.0.0...v1.0.1) (2024-05-29)


### Bug Fixes

* fixed build workflow to ignore tests, as there are none in this project ([6b65976](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/6b65976aedb857381fca9c97d9490d370b975ab5))

## 1.0.0 (2024-05-29)


### Features

* moved general purpose code from nextjs sdk to this sdk ([0d82c4f](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/0d82c4fb33be6214a20a55ef7e535e5a90bbbd2a))


### Bug Fixes

* added redis conditional execution to avoid build failures ([4ef8b7c](https://github.com/flowcore-io/library-sdk-transformer-core-ts/commit/4ef8b7c1e445b3fd6b248132beeb896d6c442785))
