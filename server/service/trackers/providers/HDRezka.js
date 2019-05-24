const { URL } = require('url')
const Provider = require('../Provider')
const urlencode = require('urlencode')
const superagent = require('superagent')
const $ = require('cheerio')

class HDRezka extends Provider {
    constructor() {
        super({
            baseUrl: 'http://hdrezka-ag.com/',
            searchUrl: 'http://hdrezka-ag.com/index.php?do=search&subaction=search',
            scope: '.b-content__inline_item',
            pageSize: 50,
            selectors: {
                id: {
                    selector: '.b-content__inline_item-link>a',
                    transform: ($el) => urlencode($el.attr('href'))
                },
                name: '.b-content__inline_item-link>a'
            },
            detailsScope: '.b-content__columns',
            detailsSelectors: {
                image: {
                    selector: '.b-sidecover img',
                    transform: ($el) => $el.attr('src')
                },
                description: {
                    selector: '.b-post__info tr',
                    transform: ($el) => {
                        return $el.toArray()
                            .map((tr) => {
                                const $td = $(tr).find('td')
                                const name = $td.eq(0).find('h2').text()
                                const value = $td.eq(1).text().trim()
                                return { name, value }
                            })
                            .filter((item) => item && item.name && item.value)
                    }
                },
                files: {
                    transform: async ($scope) => {
                        let files = []
                        const $translations = $scope.find('.b-translators__list')
                        if($translations.length > 0) {
                            files = await this._extractTranslationFiles($scope, $translations)
                        } else {
                            files = this._extractNoTranslationFiles($scope)
                        }

                        return files.map((item, index) => ({
                            id: index,
                            index,
                            hlsProxy: { type: 'streamguard' },
                            ...item
                        }))
                    }
                }
            }
        })
    }

    async _extractTranslationFiles($scope, $translations) {
        const posterId = $scope.find('.b-simple_episode__item').first().attr('data-id')
        // files with translations
        const t = $translations
            .find('.b-translator__item')
            .toArray()
            .map(async (translation) => {
                const $translation = $(translation)
                const name = $translation.text()
                const url = $translation.attr('data-cdn_url')

                if(url) {
                    return {
                        name,
                        hlsUrl: url
                    }
                } else {
                    const title = $translation.attr('title')
                    const translatorId = $translation.attr('data-translator_id')

                    const res = await superagent
                        .post(`${this.config.baseUrl}ajax/get_cdn_series/`)
                        .type('form')
                        .field({
                            'id': posterId,
                            'translator_id': translatorId,
                        })
                        .buffer(true)
                        .parse(superagent.parse['application/json'])

                    const { seasons, episodes, player } = res.body
                    const $seasons = $.load(seasons)('.b-simple_season__item')
                    const $episodesLists = $.load(episodes)('.b-simple_episodes__list')
                    const cdnPlayerUrl = $.load(player)('#cdn-player').attr('src')

                    return this
                        ._extarctSeasonFiles(cdnPlayerUrl, $episodesLists, $seasons)
                        .map((file) => ({
                            ...file,
                            path: `${title} / ${file.path}`
                        }))
                }
            })

        return (await Promise.all(t)).reduce((acc, item) => acc.concat(item), [])
    }

    _extractNoTranslationFiles($scope) {
        const $seasons = $scope.find('.b-simple_season__item')
        const cdnPlayerUrl = $scope.find('#cdn-player').attr('src')
        if($seasons.length > 0) {
            // tv show with single translation
            const $episodesLists = $scope.find('.b-simple_episodes__list')

            return this._extarctSeasonFiles(cdnPlayerUrl, $episodesLists, $seasons)
        } else {
            // single file
            const name = $scope.find('.b-post__title>h1').text()

            return [{
                name,
                hlsUrl: cdnPlayerUrl
            }]
        }
    }

    _extarctSeasonFiles(cdnPlayerUrl, $episodesLists, $seasons) {
        const seasonsCount = $seasons.length

        const files = []

        for(let s = 1; s <= seasonsCount; s++) {
            const episodesCount = $episodesLists.eq(s-1).children().length

            for(let e = 1; e <= episodesCount; e++) {
                const url = new URL(cdnPlayerUrl)
                url.searchParams.set('season', 1)
                url.searchParams.set('episode', 1)

                files.push({
                    path: `Season ${s}`,
                    name: `Season ${s} / Episode ${e}`,
                    hlsUrl: url.toString()
                })
            }
        }

        return files
    }

    _postProcessResultDetails(details, resultsId) {
        details.files.forEach((file) => {
            file.hlsProxy.params = { referer: resultsId }
        })

        return details
    }

    getName() {
        return 'hdrezka'
    }

    getType() {
        return 'directMedia'
    }

    getSearchUrl(query) {
        return `${this.config.searchUrl}&q=${query}`
    }

    getInfoUrl(resultsId) {
        return urlencode.decode(resultsId)
    }
}

module.exports = HDRezka