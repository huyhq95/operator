import knot from 'knot.js'
import delegate from 'delegate'
import nanoajax from 'nanoajax'
import navigo from 'navigo'
import dom from './lib/dom.js'
import { 
  origin, 
  sanitize,
  saveScrollPosition, 
  link,
  setActiveLinks
} from './lib/util.js'

const router = new navigo(origin)

const state = {
  _state: {
    route: window.location.pathname,
    title: document.title,
    prev: {
      route: '/',
      title: '',
    }
  },
  get route(){
    return this._state.route
  },
  set route(loc){
    this._state.prev.route = this.route
    this._state.route = loc
    setActiveLinks(loc)
  },
  get title(){
    this._state.prev.title = this.title
    return this._state.title
  },
  set title(val){
    document.title = val
  }
}

const matches = (route, tests) => (
  tests.filter(t => t(route)).length > 0 ? true : false 
)

export default (options = {}) => {
  const root = options.root || document.body
  const duration = options.duration || 0
  const ignore = options.ignore || []

  const events = knot()
  const render = dom(root, duration, events)

  const instance = Object.create({
    ...events,
    stop(){ state.paused = true },
    start(){ state.paused = false },
    go
  }, {
    getState: {
      value: () => state._state
    }
  })

  delegate(document, 'a', 'click', (e) => {
    let a = e.delegateTarget
    let href = a.getAttribute('href') || '/'
    let route = sanitize(href)

    if (
      !link.isSameOrigin(href)
      || a.getAttribute('rel') === 'external'
      || matches(route, ignore)
    ){ return }

    e.preventDefault()

    if (link.isHash(href)){ 
      events.emit('hash', href)
      pushRoute(`${state.route}/${href}`)
      return
    }

    if (
      link.isSameURL(href)
    ){ return }

    saveScrollPosition()

    go(`${origin}/${route}`, (to, title) => {
      router.navigate(to)

      // Update state
      pushRoute(to, title)
    })
  })

  window.onpopstate = e => {
    let to = e.target.location.href

    if (matches(to, ignore)){ 
      window.location.reload()
      return 
    }

    go(to, (loc, title) => {
      /**
       * Popstate bypasses router, so we 
       * need to tell it where we went to
       * without pushing state
       */
      router.resolve(loc)

      // Update state
      pushRoute(loc, title)
    })
  }

  if ('scrollRestoration' in history){
    history.scrollRestoration = 'manual'

    if (history.state && history.state.scrollTop !== undefined){
      window.scrollTo(0, history.state.scrollTop)
    }

    window.onbeforeunload = saveScrollPosition 
  }

  function get(route, cb){
    return nanoajax.ajax({ 
      method: 'GET', 
      url: route 
    }, (status, res, req) => {
      if (req.status < 200 || req.status > 300 && req.status !== 304){
        return window.location = `${origin}/${state._state.prev.route}`
      }
      render(req.response, cb) 
    })
  }

  function go(route, cb = () => {}){
    let to = sanitize(route)

    events.emit('before:route', {route: to})

    if (state.paused){ return }

    let req = get(`${origin}/${to}`, title => {
      events.emit('after:route', {route: to, title})

      cb(to, title)
    })
  }

  function pushRoute(loc, title){
    state.route = loc
    state.title = title
  }

  return instance
}
