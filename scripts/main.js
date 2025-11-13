/*Funcionalidade do ScrolReveal */
ScrollReveal({
    origin: 'bottom',
    distance: '50px',
    duration: 1500
  }).reveal(`
        #home header,
        #home .content,
        #home .stat,
        #services,
        #services header,
        #services .card,
        #depositions header
  `);
  ScrollReveal({
    origin: 'bottom',
    distance: '30px',
    duration: 1800
  }).reveal(`
        #business-model header h4,
        #business-model header h2,
        #business-model header p
  `);

// reveal cards of section #services >> differential
  ScrollReveal({
    origin: 'left',
    distance: '80px',
    duration: 2500
  }).reveal(`
        #home img,
        #services .differential .card-left
  `);

  ScrollReveal({
    origin: 'bottom',
    distance: '80px',
    duration: 2500
  }).reveal(`
        #services .differential .card-bottom
  `);

  ScrollReveal({
    origin: 'top',
    distance: '50px',
    duration: 2500
  }).reveal(`
        #depositions .comments-cards
  `);

/*Funcionalidade stats*/
var divStat = document.querySelector('.stat')
var statNumber1 = document.getElementById('statNumber1')
var statNumber2 = document.getElementById('statNumber2')
var statNumber3 = document.getElementById('statNumber3')

var count1 = 0;
var count2 = 0;
var count3 = 0;


  var load = setInterval(setStatNumber,80)


var positionElStat = (divStat.getBoundingClientRect().top) -10;
var positionLoad = window.innerHeight;
var dif = positionElStat-positionLoad;

function setStatNumber(){
  if(positionElStat < positionLoad || scrollY > dif){
    if(count1 < 20){
      count1 += 1;
      statNumber1.textContent = "+" + count1;

    }else if(count2 < 12){
      count2 += 1;
      statNumber2.textContent = "+" + count2;
    }else if(count3 < 10){
      count3 += 1;
      statNumber3.textContent = "+" + count3;
    }else{
      clearInterval(load)
    }
  }


}


/*Funcionalidade do seletor de serviços */

const btnService1 = document.getElementById('contabilidade-completa');
const btnService2 = document.getElementById('consultoria');
var secservice1 = document.getElementById('secservice1');
var secservice2 = document.getElementById('secservice2');

function showSecService1(){

    btnService2.classList.remove('selected')
    btnService1.classList.add('selected')

    secservice2.classList.remove('showing')
    secservice2.classList.add('hidden')

    secservice1.classList.remove('hidden')
    secservice1.classList.add('showing')
};

function showSecService2(){

  btnService1.classList.remove('selected')
  btnService2.classList.add('selected')

  secservice1.classList.remove('showing')
  secservice1.classList.add('hidden')

  secservice2.classList.remove('hidden')
  secservice2.classList.add('showing')
};

btnService1.addEventListener('click',showSecService1);
btnService2.addEventListener('click',showSecService2);


/*Funcionalidade do accordion */

var buttonsAccordion = document.querySelectorAll('.accordion-button');


const accordionCreate = (i) =>{

  var iArray = i -1;

  var clsContentAccordion = `flush-collapse${i}`;

  function showAccordion(c){

    var contenAccordion = document.getElementById(c)

    buttonsAccordion[iArray].classList.toggle('active')
   
    contenAccordion.classList.toggle('content-accordion-hidden')
    contenAccordion.classList.toggle('content-accordion-show')
  }
  buttonsAccordion[iArray].addEventListener('click', function() {showAccordion(clsContentAccordion)})
}

accordionCreate(1);
accordionCreate(2);
accordionCreate(3);
accordionCreate(4);