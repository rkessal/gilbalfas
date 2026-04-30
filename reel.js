window.addEventListener('load', onLoad)

function onLoad() {
  function createEventBus() {
    const e = {}
    return {
      on(t, fn) { (e[t] ??= []).push(fn) },
      emit(t, d) { (e[t] || []).forEach(fn => fn(d)) }
    }
  }

  function createMachine(initial, states, bus) {
    let current = initial

    function send(event, payload) {
      const def = states[current]
      const next = def?.on?.[event]
      if (!next) return current

      const leave = states[current]?.leave
      if (leave) leave()

      const enter = states[next]?.enter
      current = next
      if (enter) enter(payload)

      bus.emit("state", current)
      return current
    }

    const enter = states[initial]?.enter
    if (enter) enter()

    return { send, get state() { return current } }
  }

  const bus = createEventBus()

  bus.on("page:animate", () => {
    const gallery = '.reel-gallery-container .elementor-widget-wrap'
    const text = '.reel-gallery-container h2'

    SplitText.create(text, {
      type: "lines, words",
      mask: "lines",
      autoSplit: true,
      onSplit(self) {
        return gsap.from(self.lines, {
          delay: 0.5,
          duration: 1,
          y: 100,
          autoAlpha: 0,
          stagger: 0.08
        });
      }
    })

    gsap.set(gallery, {
      clipPath: 'inset(0%, 100%, 0%, 0%)',
    })
    gsap.fromTo(gallery, {
      // clipPath: 'inset(0%, 100%, 0%, 0%)',
      autoAlpha: 0,
    }, {
      clipPath: 'inset(0%, 100%, 0%, 100%)',
      ease: 'power4.inOut',
      duration: 1.5,
      autoAlpha: 1,
      stagger: 0.08
    })
  })

  bus.on("video:mount", link => {
    const video = getVideo()

    gsap.set(video, {
      clipPath: "inset(0% 0% 0% 0%)",
    })

    gsap.to(video, {
      clipPath: 'inset(50% 0% 50% 0%)',
      duration: 1.5,
      ease: 'power4.inOut',
      autoAlpha: 0,
      onComplete: () => {
        video.src = ""
        video.src = link
        machine.send("READY", link)
      }
    })
  })

  bus.on("video:play", id => {
    const video = container.querySelector("video")
    console.log({
      container,
      video
    })
    if (!video) return

    window.scrollTo({ top: 0 })

    gsap.fromTo(video, {
      clipPath: 'inset(50% 0% 50% 0%)',
    }, {
      autoAlpha: 1,
      clipPath: 'inset(0% 0% 0% 0%)',
      ease: 'power4.inOut',
      duration: 1.5,
    })
  })


  const machine = createMachine("idle", {
    idle: {
      enter() {
        bus.emit("page:animate")
      },
      on: { PLAY: "loading" }
    },

    loading: {
      enter(id) {
        bus.emit("video:mount", id)
      },
      on: { READY: "playing" }
    },

    playing: {
      enter(id) {
        bus.emit("video:play", id)
      },
      on: { PLAY: "loading" }
    }

  }, bus)

  let container = document.querySelector(".reel-video-container .elementor-open-inline")

  function getVideo() {
    const video = container.querySelector("video")
    return video
  }

  const videos = document.querySelectorAll(".reel-gallery-container .elementor-widget-video .elementor-video")

  videos.forEach(el => {
    const url = el.src
    el.addEventListener("click", () => {
      machine.send("PLAY", url)
    })
  })
}