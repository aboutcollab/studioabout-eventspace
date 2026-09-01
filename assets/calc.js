
(function(){
  var D = window.SA_DATA; if(!D) return;
  var $ = function(s,r){return (r||document).querySelector(s);};
  var $$ = function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));};
  var eur = function(n){
    return '€' + n.toLocaleString('nl-NL',{minimumFractionDigits:2,maximumFractionDigits:2});
  };

  var state = {
    audience:'business', setup:'workshop', people:24,
    from:'13:00', to:'19:00', date:'',
    food:'', drinks:'', drinkHours:null, addons:{}, hetsalon:false, ac:false, acNote:''
  };

  /* ---- hours. The guest books their own access window; we never add to it.
         An end time earlier than the start means the event runs past midnight. ---- */
  function hhmm(s){ var p=(s||'').split(':'); return (+p[0]) + (+p[1])/60; }
  function hours(){
    var a=hhmm(state.from), b=hhmm(state.to);
    if(isNaN(a)||isNaN(b)) return 0;
    if(b<=a) b+=24;
    return Math.round((b-a)*100)/100;
  }
  function nightHours(){
    var a=hhmm(state.from), b=hhmm(state.to);
    if(isNaN(a)||isNaN(b)) return 0;
    if(b<=a) b+=24;
    return Math.max(0, b - Math.max(a, D.night_from));
  }
  function bandFor(){
    var p = state.people, key = state.setup;
    for(var i=0;i<D.bands.length;i++){
      var r = D.bands[i][key];
      if(r && p>=r[0] && p<=r[1]) return D.bands[i];
    }
    /* above every published range for this setup */
    return null;
  }

  function calc(){
    var h = hours(), nh = nightHours(), band = bandFor(), pp = state.people;
    var lines = [], lo = 0, hi = 0, ranged = false;
    var btwLo = 0, btwHi = 0;
    function add(label, sub, amtLo, amtHi, btw){
      if(amtHi === undefined) amtHi = amtLo;
      lo += amtLo; hi += amtHi;
      btwLo += amtLo*btw; btwHi += amtHi*btw;
      if(amtHi !== amtLo) ranged = true;
      lines.push({label:label, sub:sub, lo:amtLo, hi:amtHi});
    }

    if(!band || h<=0) return {ok:false, band:band, h:h};

    /* room */
    var dayHours = h - nh;
    var room = band.price * dayHours;
    var nightAdd = band.price * nh * (1 + D.night_pct);
    var roomTotal = room + nightAdd;
    var disc = state.hetsalon ? (1 - D.hetsalon_room_discount) : 1;
    roomTotal *= disc;
    var roomSub = h.toFixed(2).replace(/\.?0+$/,'') + ' h × €' + band.price.toFixed(0) +
                  ' · ' + band.label + (state.hetsalon ? ' · −30% Het Salon' : '');
    add('The room', roomSub, roomTotal, roomTotal, D.btw.service);
    if(nh > 0){
      lines[lines.length-1].sub += ' · incl. ' + nh.toFixed(2).replace(/\.?0+$/,'') +
        ' night h at +' + Math.round(D.night_pct*100) + '%';
    }

    /* cleaning — on top, every event, paid to the kitchen */
    add('Cleaning', band.label, band.cleaning, band.cleaning, D.btw.service);

    /* food */
    var f = null;
    D.food.forEach(function(r){ if(r.key===state.food) f=r; });
    if(f){
      var fd = state.hetsalon ? (1 - D.hetsalon_food_discount) : 1;
      if(f.key === 'bites'){
        add('Brazilian bites', '€'+D.bites_lo.toFixed(2).replace('.',',')+'–'+
            D.bites_hi.toFixed(2).replace('.',',')+' pp · quoted per event · ~'+
            D.bites_pieces+' pieces pp',
            D.bites_lo*pp*fd, D.bites_hi*pp*fd, f.btw);
      } else if(f.per_hour){
        var bh = Math.max(state.drinkHours || h, D.drinks_min_hours);
        add(f.label.split('—')[0].trim(),
            '€'+f.pp.toFixed(2).replace('.',',')+' pp per hour × '+pp+' × '+
            bh.toFixed(2).replace(/\.?0+$/,'')+' h',
            f.pp*pp*bh*fd, f.pp*pp*bh*fd, f.btw);
      } else {
        var unit = f.pp;
        var surcharge = 0;
        /* under the buffet minimum the plated menus are the offer; a buffet costs +€2 pp */
        if(pp < D.small_group_min && f.key.indexOf('buffet')>-1) surcharge = D.small_group_surcharge;
        add(f.label.split('—')[0].trim(),
            '€'+(unit+surcharge).toFixed(2).replace('.',',')+' pp × '+pp+
            (surcharge? ' · incl. €'+surcharge.toFixed(2).replace('.',',')+
              ' small-group surcharge under '+D.small_group_min : ''),
            (unit+surcharge)*pp*fd, (unit+surcharge)*pp*fd, f.btw);
      }
    }

    /* drinks */
    var dr = null;
    D.drinks.forEach(function(r){ if(r.key===state.drinks) dr=r; });
    if(dr){
      var dh = Math.max(state.drinkHours || h, D.drinks_min_hours);
      var dd = state.hetsalon ? (1 - D.hetsalon_food_discount) : 1;
      var drName = dr.label.indexOf('—') > -1
        ? 'Drinks: ' + dr.label.split('—')[1].replace(/^\s*\+\s*/,'').trim()
        : dr.label;
      add(drName,
          '€'+dr.pph.toFixed(2).replace('.',',')+' pp per hour × '+pp+' × '+
          dh.toFixed(2).replace(/\.?0+$/,'')+' h',
          dr.pph*pp*dh*dd, dr.pph*pp*dh*dd, dr.btw);
    }

    /* add-ons */
    D.addons.forEach(function(a){
      if(state.addons[a.key]) add(a.label, 'per event', a.price, a.price, a.btw);
    });

    var totLo = lo + btwLo, totHi = hi + btwHi;
    return {ok:true, band:band, h:h, nh:nh, lines:lines, exLo:lo, exHi:hi,
            btwLo:btwLo, btwHi:btwHi, incLo:totLo, incHi:totHi, ranged:ranged};
  }

  function money(lo, hi, ranged){
    return ranged ? eur(lo)+' – '+eur(hi) : eur(lo);
  }

  function render(){
    var out = $('#receipt'); if(!out) return;
    var r = calc(), inc = (state.audience === 'private');
    updateMiniBar(r, inc);
    if(!r.ok){
      var why;
      if(r.h<=0) why = 'Set a start and an end time and the price appears here.';
      else why = 'For a '+state.setup+' setup we publish prices up to '+
                 maxFor(state.setup)+' people. Above that, talk to us. We will still make it work.';
      out.innerHTML = '<h3>Your event</h3><p class="r-empty">'+why+'</p>';
      return;
    }
    var h = '<h3>Your event</h3>';
    r.lines.forEach(function(l){
      h += '<div class="r-line"><span class="l">'+l.label+'<small>'+l.sub+'</small></span>'+
           '<span class="v">'+money(l.lo,l.hi,l.lo!==l.hi)+'</span></div>';
    });
    var mainLo = inc ? r.incLo : r.exLo, mainHi = inc ? r.incHi : r.exHi;
    var othLo  = inc ? r.exLo  : r.incLo, othHi = inc ? r.exHi : r.incHi;
    h += '<div class="r-total"><span class="l">Total '+(inc?'incl.':'excl.')+' BTW</span>'+
         '<span class="v">'+money(mainLo,mainHi,r.ranged)+'</span></div>';
    h += '<div class="r-sub"><span>'+(inc?'Excl.':'Incl.')+' BTW</span><span>'+
         money(othLo,othHi,r.ranged)+'</span></div>';
    h += '<div class="r-sub"><span>Per person ('+state.people+')</span><span class="r-pp">'+
         money(mainLo/state.people, mainHi/state.people, r.ranged)+'</span></div>';
    h += '<div class="r-sub"><span>Deposit, refundable</span><span>'+eur(D.borg)+'</span></div>';
    if(r.ranged){
      h += '<div class="r-warn">The bites are tailored to your event, so the total is a range '+
           'until we have written your offer.</div>';
    }
    if(state.ac){
      h += '<div class="r-line"><span class="l">Creative workshop'
        + '<small>About Collab will come back with an idea</small></span>'
        + '<span class="v">to discuss</span></div>';
    }
    h += '<div class="r-note">The hours you book are the hours you have the space, '+
         'set-up and clear-out included. Stay longer and the extra time is charged at the '+
         'same hourly rate.<br>Projector and screen come with the room.</div>';
    h += '<a class="btn" href="#request">Book this date</a>';
    out.innerHTML = h;
    renderRecap(r, inc);
  }

  /* Drinks and the borrel are sold per person per hour. They should be billed for the
     hours you are actually serving, not for the whole booked window — the booking includes
     set-up and clear-out, and nobody is drinking during those. Defaults to the booked
     hours, and the guest can lower it. */
  function servedItemSelected(){
    var f = null; D.food.forEach(function(r){ if(r.key===state.food) f=r; });
    var d = null; D.drinks.forEach(function(r){ if(r.key===state.drinks) d=r; });
    return !!(d || (f && f.per_hour));
  }
  function syncServe(){
    var row = $('#serveRow'); if(!row) return;
    var on = servedItemSelected();
    row.hidden = !on;
    var el = $('#f_servehours');
    if(on && el && !el.value) el.value = Math.max(hours(), D.drinks_min_hours) || '';
    if(!on) state.drinkHours = null;
  }

  /* the phone's pinned running total. Hidden until there is a real number to show, so
     it never sits there saying nothing. */
  function updateMiniBar(r, inc){
    var bar = $('#miniBar'), fig = $('#mbTotal');
    if(!bar || !fig) return;
    if(!r || !r.ok){ bar.hidden = true; return; }
    fig.textContent = money(inc ? r.incLo : r.exLo, inc ? r.incHi : r.exHi, r.ranged)
                    + (inc ? '' : ' excl.');
    bar.hidden = false;
  }

  function maxFor(setup){
    var m = 0;
    D.bands.forEach(function(b){ if(b[setup] && b[setup][1] > m) m = b[setup][1]; });
    return m;
  }

  /* The reservation recap. The booking system itself is a Phase-4 build (Helena,
     1 Sep) — nothing can be booked before January — so this shows the experience end
     to end with no back end behind it. The footer says so in plain words. */
  function renderRecap(r, inc){
    var el = $('#bookRecap'); if(!el) return;
    if(!r || !r.ok){
      /* rent.html has the form but no calculator, so point at the one that exists */
      var here = !!$('#calc');
      el.innerHTML = '<h3>Your reservation</h3><p class="r-empty">'
        + (here ? 'Build your event above and it appears here, ready to send.'
                : 'Price your event first and every line shows up here, ready to send.')
        + '</p>'
        + (here ? '' : '<a class="btn" href="prices.html#calc">Price your event</a>');
      return;
    }
    var h = '<h3>Your reservation</h3>';
    h += '<div class="r-line"><span class="l">When<small>' + (state.date || 'no date yet')
      + '</small></span><span class="v">' + state.from + '–' + state.to + '</span></div>';
    h += '<div class="r-line"><span class="l">Who<small>' + state.setup
      + ' setup · ' + r.band.label + '</small></span><span class="v">' + state.people
      + ' people</span></div>';
    r.lines.forEach(function(l){
      h += '<div class="r-line"><span class="l">' + l.label + '<small>' + l.sub
        + '</small></span><span class="v">' + money(l.lo, l.hi, l.lo !== l.hi) + '</span></div>';
    });
    h += '<div class="r-total"><span class="l">Total ' + (inc ? 'incl.' : 'excl.')
      + ' BTW</span><span class="v">'
      + money(inc ? r.incLo : r.exLo, inc ? r.incHi : r.exHi, r.ranged) + '</span></div>';
    h += '<div class="r-sub"><span>Deposit, refundable</span><span>' + eur(D.borg) + '</span></div>';
    h += '<div class="r-note">Nothing is charged now. We confirm the date first.</div>';
    el.innerHTML = h;
  }

  function initBooking(){
    var f = $('#bookForm'); if(!f) return;
    if(!$('#calc')) renderRecap(null, false);   /* no calculator on this page */
    f.addEventListener('submit', function(ev){
      ev.preventDefault();
      var name = ($('#b_name') || {}).value || '';
      var mail = ($('#b_email') || {}).value || '';
      if(!name.trim() || !mail.trim()){
        if(!name.trim() && $('#b_name')) $('#b_name').focus();
        else if($('#b_email')) $('#b_email').focus();
        return;
      }
      var when = state.date ? state.date + ', ' + state.from + '–' + state.to
                            : state.from + '–' + state.to;
      f.innerHTML =
        '<div class="sent">'
        + '<div class="sent-mark" aria-hidden="true"></div>'
        + '<h3>Thank you, ' + name.split(' ')[0].replace(/[<>&]/g, '') + '.</h3>'
        + '<p>Your reservation for <b>' + when + '</b> is with us. We will come back to you '
        + 'within 24 hours to confirm the date. Nothing is charged before then.</p>'
        + '<p class="sent-note">We will reply to ' + mail.replace(/[<>&]/g, '') + '.</p>'
        + '</div>';
      f.scrollIntoView({block:'center', behavior:'smooth'});
    });
  }

  /* a plain-text copy of the receipt, kept for the email route */
  function plain(r, inc){
    var t = 'MY EVENT\n';
    t += 'Date: '+(state.date||'no date yet')+'  '+state.from+'–'+state.to+'  ('+r.h+' h booked)\n';
    t += 'People: '+state.people+', '+state.setup+' setup  →  '+r.band.label+
         ' at €'+r.band.price.toFixed(0)+'/h\n';
    t += (state.audience==='private'?'Private event':'Business event')+
         (state.hetsalon?' · Het Salon community':'')+'\n\n';
    r.lines.forEach(function(l){
      t += '- '+l.label+' ('+l.sub+'): '+money(l.lo,l.hi,l.lo!==l.hi)+'\n';
    });
    t += '\nTotal '+(inc?'incl.':'excl.')+' BTW: '+money(inc?r.incLo:r.exLo, inc?r.incHi:r.exHi, r.ranged);
    t += '\nDeposit (refundable): '+eur(D.borg)+'\n';
    return t;
  }

  /* ---------- wiring ---------- */
  function bindSeg(sel, key, after){
    $$(sel+' button').forEach(function(b){
      b.addEventListener('click', function(){
        state[key] = b.dataset.v;
        $$(sel+' button').forEach(function(x){ x.setAttribute('aria-pressed', String(x===b)); });
        if(after) after();
        render();
      });
    });
  }

  function init(){
    if(!$('#calc')) return;
    bindSeg('#segAudience','audience');
    bindSeg('#segSetup','setup');
    ['date','from','to'].forEach(function(k){
      var el = $('#f_'+k); if(!el) return;
      el.value = state[k];
      el.addEventListener('input', function(){ state[k]=el.value; render(); });
    });
    var ppl = $('#f_people');
    if(ppl){
      ppl.value = state.people;
      ppl.addEventListener('input', function(){
        var v = parseInt(ppl.value,10);
        state.people = (isNaN(v)||v<1) ? 1 : v; render();
      });
    }
    ['food','drinks'].forEach(function(k){
      var el = $('#f_'+k); if(!el) return;
      el.addEventListener('change', function(){ state[k]=el.value; syncServe(); render(); });
    });
    var sh = $('#f_servehours');
    if(sh) sh.addEventListener('input', function(){
      var v = parseFloat(sh.value);
      state.drinkHours = (isNaN(v)||v<=0) ? null : v;
      render();
    });
    $$('#calc .addon').forEach(function(c){
      c.addEventListener('change', function(){ state.addons[c.dataset.k]=c.checked; render(); });
    });
    var hs = $('#f_hetsalon');
    if(hs) hs.addEventListener('change', function(){ state.hetsalon=hs.checked; render(); });

    /* step 7: the About Collab opt-in. Opening the note field only once it is ticked keeps
       the calculator short for everyone who does not want a workshop. */
    var ac = $('#f_ac'), acRow = $('#acRow'), acNote = $('#f_acnote');
    if(ac) ac.addEventListener('change', function(){
      state.ac = ac.checked;
      if(acRow) acRow.hidden = !ac.checked;
      if(ac.checked && acNote) acNote.focus();
      render();
    });
    if(acNote) acNote.addEventListener('input', function(){ state.acNote = acNote.value; });

    /* deep-link presets, so a use-case page opens the calculator already set up:
       ?setup=dinner&people=40&from=18:00&to=23:00&food=dinner_buffet&drinks=p3 */
    var q = new URLSearchParams(location.search);
    ['setup','from','to','food','drinks','audience'].forEach(function(k){
      if(q.has(k)) state[k] = q.get(k);
    });
    if(q.has('people')) state.people = parseInt(q.get('people'),10) || state.people;
    ['from','to','date'].forEach(function(k){ var el=$('#f_'+k); if(el) el.value=state[k]; });
    if($('#f_people')) $('#f_people').value = state.people;
    if($('#f_food')) $('#f_food').value = state.food;
    if($('#f_drinks')) $('#f_drinks').value = state.drinks;
    syncServe();
    ['audience','setup'].forEach(function(k){
      $$('#seg'+k.charAt(0).toUpperCase()+k.slice(1)+' button').forEach(function(b){
        b.setAttribute('aria-pressed', String(b.dataset.v === state[k]));
      });
    });
    render();
  }

  /* setup-render switcher on the space section */
  function initSetups(){
    var stage = $('#setupImg'); if(!stage) return;
    $$('#setupBtns button').forEach(function(b){
      b.addEventListener('click', function(){
        stage.src = b.dataset.img;
        stage.alt = b.dataset.alt;
        var m = $('#setupMeta'); if(m) m.textContent = b.dataset.meta;
        $$('#setupBtns button').forEach(function(x){ x.setAttribute('aria-pressed', String(x===b)); });
      });
    });
  }

  /* test seam: lets the QA harness compute a scenario headlessly and compare the
     result against the Python engine. Harmless in production, used by qa_calc.py. */
  window.__saCalc = function(patch){
    var keep = JSON.parse(JSON.stringify(state));
    for(var k in patch) state[k] = patch[k];
    var r = calc();
    state = keep;
    return r;
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){
      init(); initSetups(); initBooking();
    });
  } else { init(); initSetups(); initBooking(); }
})();
