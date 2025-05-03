import json
import sys 
    
#Transporte, Servicios Generales, Accesibilidd, Comercio, Cultura, "link de imagen"

#estacion : ["transporte", "servicios", "accesibilidad","comercio", "cultura", "link"],

stationsSchematics = {
  
  "san pablo l1" : ["https://media.discordapp.net/attachments/792250794296606743/908383616168509490/unknown.png", "https://www.metro.cl/estacion/isometricas/san-pablo-l1.pdf"],

  "neptuno" : ["https://cdn.discordapp.com/attachments/792250794296606743/908384059812630538/unknown.png", "https://www.metro.cl/estacion/isometricas/neptuno.pdf"],

  "pajaritos" : ["https://media.discordapp.net/attachments/792250794296606743/908384804297388082/unknown.png", "https://www.metro.cl/estacion/isometricas/neptuno.pdf"],

  "las rejas": ["https://cdn.discordapp.com/attachments/792250794296606743/908419029084020796/unknown.png", "https://www.metro.cl/estacion/isometricas/las-rejas.pdf"],

  "ecuador": ["https://media.discordapp.net/attachments/792250794296606743/908419649950060544/unknown.png", "https://www.metro.cl/estacion/isometricas/ecuador.pdf"],

  "san alberto hurtado": ["https://cdn.discordapp.com/attachments/792250794296606743/908420052636794951/unknown.png", "https://www.metro.cl/estacion/isometricas/san-alberto-hurtado.pdf"],

  "universidad de santiago": ["https://cdn.discordapp.com/attachments/792250794296606743/908421584631504946/unknown.png", "https://www.metro.cl/estacion/isometricas/universidad-de-santiago.pdf"],

  "estacion central": ["https://media.discordapp.net/attachments/792250794296606743/908507324757471242/unknown.png", "https://www.metro.cl/estacion/isometricas/estacion-central.pdf", "Estación Central"],

  "union latinoamericana": ["https://media.discordapp.net/attachments/792250794296606743/908511398819147786/unknown.png", "https://www.metro.cl/estacion/isometricas/union-latinoamericana.pdf"],

  "republica": ["https://media.discordapp.net/attachments/792250794296606743/908512182357082162/unknown.png", "https://www.metro.cl/estacion/isometricas/republica.pdf"],

  "los heroes l1": ["https://media.discordapp.net/attachments/792250794296606743/908512877852368907/unknown.png", "https://www.metro.cl/estacion/isometricas/los-heroes-l1.pdf"],

  "la moneda": ["https://media.discordapp.net/attachments/792250794296606743/908712276729671710/unknown.png", "https://www.metro.cl/estacion/isometricas/la-moneda.pdf"],

  "universidad de chile l1": ["https://media.discordapp.net/attachments/792250794296606743/908712663561936896/unknown.png", "https://www.metro.cl/estacion/isometricas/universidad-de-chile.pdf"],

  "santa lucia": ["https://media.discordapp.net/attachments/792250794296606743/908713814952919080/unknown.png", "https://www.metro.cl/estacion/isometricas/santa-lucia.pdf"],

  "universidad catolica" : ["https://media.discordapp.net/attachments/792250794296606743/908715124011982888/unknown.png", "https://www.metro.cl/estacion/isometricas/universidad-catolica.pdf"],

  "baquedano l1" : ["https://media.discordapp.net/attachments/792250794296606743/908717439821418586/unknown.png", "https://www.metro.cl/estacion/isometricas/baquedano-l1.pdf"],

  "salvador" : ["https://media.discordapp.net/attachments/792250794296606743/908724445533843536/unknown.png", "https://www.metro.cl/estacion/isometricas/salvador.pdf"],

  "manuel montt" : ["https://media.discordapp.net/attachments/792250794296606743/908729960078913637/unknown.png", "https://www.metro.cl/estacion/isometricas/manuel-montt.pdf"],

  "pedro de valdivia": ["https://media.discordapp.net/attachments/792250794296606743/908814339480367114/unknown.png", "https://www.metro.cl/estacion/isometricas/pedro-de-valdivia.pdf"],

  "los leones l1": ["https://cdn.discordapp.com/attachments/792250794296606743/908845311810756648/unknown.png", "https://www.metro.cl/estacion/isometricas/los-leones.pdf"],

  "tobalaba l1" : ["https://media.discordapp.net/attachments/792250794296606743/908852087574638612/unknown.png", "https://www.metro.cl/estacion/isometricas/tobalaba-l1.pdf"],

  "el golf" : ["https://cdn.discordapp.com/attachments/792250794296606743/908854945858592818/unknown.png", "https://www.metro.cl/estacion/isometricas/el-golf.pdf"],

  "alcantara" : ["https://cdn.discordapp.com/attachments/792250794296606743/908858641543753828/unknown.png", "https://www.metro.cl/estacion/isometricas/alcantara.pdf"],

  "escuela militar" : ["https://cdn.discordapp.com/attachments/792250794296606743/908861555087642664/unknown.png", "https://www.metro.cl/estacion/isometricas/escuela-militar.pdf"],

  "manquehue" : ["https://cdn.discordapp.com/attachments/792250794296606743/908862981033590854/unknown.png", "https://www.metro.cl/estacion/isometricas/manquehue.pdf"],

  "hernando de magallanes" : ["https://cdn.discordapp.com/attachments/792250794296606743/908864996207902750/unknown.png", "https://www.metro.cl/estacion/isometricas/hernando-magallanes.pdf"],

  "los dominicos" : ["https://cdn.discordapp.com/attachments/792250794296606743/908867196510404608/unknown.png", "https://www.metro.cl/estacion/isometricas/los-dominicos.pdf"],

  "vespucio norte" : ["https://cdn.discordapp.com/attachments/792250794296606743/908852941748854835/unknown.png", "https://www.metro.cl/estacion/isometricas/vespucio-norte.pdf"],

  "zapadores" : ["https://cdn.discordapp.com/attachments/792250794296606743/908847634075226122/unknown.png", "https://www.metro.cl/estacion/isometricas/zapadores.pdf"],
  
  "dorsal" : ["https://media.discordapp.net/attachments/792250794296606743/908730783278174208/unknown.png", "https://www.metro.cl/estacion/isometricas/dorsal.pdf"],

  "einstein" : ["https://media.discordapp.net/attachments/792250794296606743/908726169829015632/unknown.png", "https://www.metro.cl/estacion/isometricas/einstein.pdf"],

  "cementerios" : ["https://media.discordapp.net/attachments/792250794296606743/908815987112022046/unknown.png?width=551&height=468", "https://www.metro.cl/estacion/isometricas/cementerios.pdf"],

  "cerro blanco" : ["https://media.discordapp.net/attachments/792250794296606743/908717992693600286/unknown.png", "https://www.metro.cl/estacion/isometricas/cerro-blanco.pdf"],

  "patronato" : ["https://media.discordapp.net/attachments/792250794296606743/908705942231744562/unknown.png", "https://www.metro.cl/estacion/isometricas/patronato.pdf"],

  "puente cal y canto l2" : ["https://media.discordapp.net/attachments/792250794296606743/908704471624876032/unknown.png", "https://www.metro.cl/estacion/isometricas/cal-y-canto.pdf"],

  "santa ana l2" : ["https://media.discordapp.net/attachments/792250794296606743/908700454949642240/unknown.png", "https://www.metro.cl/estacion/isometricas/santa-ana-l2.pdf"],

  "los heroes l2": ["https://media.discordapp.net/attachments/792250794296606743/908513078675644416/unknown.png", "https://www.metro.cl/estacion/isometricas/los-heroes-l2.pdf"],

  "toesca" : ["https://cdn.discordapp.com/attachments/792250794296606743/908705583333531708/unknown.png", "https://www.metro.cl/estacion/isometricas/toesca.pdf"],

  "parque ohiggins" : ["https://media.discordapp.net/attachments/792250794296606743/908719432971485224/unknown.png", "https://www.metro.cl/estacion/isometricas/parque-ohiggins.pdf"],

  "rondizzoni" : ["https://media.discordapp.net/attachments/792250794296606743/908726029516951552/unknown.png", "https://www.metro.cl/estacion/isometricas/rondizzoni.pdf"],

  "franklin l2" : ["https://media.discordapp.net/attachments/792250794296606743/908731134320459786/unknown.png", "https://www.metro.cl/estacion/isometricas/franklin.pdf"],

  "el llano" : ["https://media.discordapp.net/attachments/792250794296606743/908816329618915368/unknown.png", "https://www.metro.cl/estacion/isometricas/el-llano.pdf"],

  "san miguel" : ["https://cdn.discordapp.com/attachments/792250794296606743/908847926460174396/unknown.png", "https://www.metro.cl/estacion/isometricas/san-miguel.pdf"],

  "lo vial" : ["https://cdn.discordapp.com/attachments/792250794296606743/908852555436683334/unknown.png", "https://www.metro.cl/estacion/isometricas/lo-vial.pdf"],

  "departamental" : ["https://cdn.discordapp.com/attachments/792250794296606743/908855383664250960/unknown.png", "https://www.metro.cl/estacion/isometricas/departamental.pdf"],

  "ciudad del nino" : ["https://media.discordapp.net/attachments/792250794296606743/908858969353760808/unknown.png", "https://www.metro.cl/estacion/isometricas/ciudad-del-nino.pdf"],

  "lo ovalle" : ["https://cdn.discordapp.com/attachments/792250794296606743/908862070928322580/unknown.png", "https://www.metro.cl/estacion/isometricas/lo-ovalle.pdf", "La Cisterna"],

  "el parron" : ["https://cdn.discordapp.com/attachments/792250794296606743/908863331413159936/unknown.png", "https://www.metro.cl/estacion/isometricas/el-parron.pdf", "La Cisterna"],

  "la cisterna l2" : ["https://cdn.discordapp.com/attachments/792250794296606743/908865345111097454/unknown.png", "https://www.metro.cl/estacion/isometricas/la-cisterna-l2.pdf", "La Cisterna"],

  "los libertadores" : ["https://media.discordapp.net/attachments/792250794296606743/908849419187814470/unknown.png", "https://www.metro.cl/estacion/isometricas/los-libertadores.pdf"],

  "cardenal caro" : ["https://media.discordapp.net/attachments/792250794296606743/908816688487759883/unknown.png", "https://www.metro.cl/estacion/isometricas/cardenal-caro.pdf"],

  "vivaceta" : ["https://media.discordapp.net/attachments/792250794296606743/908732564037074974/unknown.png", "https://www.metro.cl/estacion/isometricas/vivaceta.pdf"],

  "conchali" : ["https://media.discordapp.net/attachments/792250794296606743/908727148985065493/unknown.png", "https://www.metro.cl/estacion/isometricas/conchali.pdf"],

  "plaza chacabuco" : ["https://media.discordapp.net/attachments/792250794296606743/908720346121777162/unknown.png", "https://www.metro.cl/estacion/isometricas/plaza-chacabuco.pdf"],

  "hospitales" : ["https://media.discordapp.net/attachments/792250794296606743/908710179078561842/unknown.png", "https://www.metro.cl/estacion/isometricas/hospitales.pdf"],

  "puente cal y canto l3" : ["https://media.discordapp.net/attachments/792250794296606743/908704860873060382/unknown.png", "https://www.metro.cl/estacion/isometricas/cal-y-canto-l3.pdf"],

  "plaza de armas l3" : ["https://media.discordapp.net/attachments/792250794296606743/908709265081004042/unknown.png", "https://www.metro.cl/estacion/isometricas/plaza-de-armas-l3.pdf"],

  "universidad de chile l3" : ["https://cdn.discordapp.com/attachments/792250794296606743/908711852568084480/unknown.png", "https://www.metro.cl/estacion/isometricas/universidad-de-chile-l3.pdf"],

  "parque almagro" : ["https://media.discordapp.net/attachments/792250794296606743/908713274554585088/unknown.png", "https://www.metro.cl/estacion/isometricas/parque-almagro.pdf"],

  "matta" : ["https://media.discordapp.net/attachments/792250794296606743/908722344099463208/unknown.png", "https://www.metro.cl/estacion/isometricas/matta.pdf"],

  "irarrazaval l3" : ["https://media.discordapp.net/attachments/792250794296606743/908727429072306216/unknown.png", "https://www.metro.cl/estacion/isometricas/irarrazaval-l3.pdf"],

  "monsenor eyzaguirre" : ["https://media.discordapp.net/attachments/792250794296606743/908732161601970216/unknown.png", "https://www.metro.cl/estacion/isometricas/monsenor-eyzaguirre.pdf"],

  "nunoa l3" : ["https://media.discordapp.net/attachments/792250794296606743/908817414811189278/unknown.png", "https://www.metro.cl/estacion/isometricas/nunoa-l3.pdf"],

  "chile espana" : ["https://media.discordapp.net/attachments/792250794296606743/908850027257032744/unknown.png", "https://www.metro.cl/estacion/isometricas/chile-espana.pdf"],

  "villa frei" : ["https://cdn.discordapp.com/attachments/792250794296606743/908853458805874718/unknown.png", "https://www.metro.cl/estacion/isometricas/villa-frei.pdf"],

  "plaza egana l3" : ["https://cdn.discordapp.com/attachments/792250794296606743/908856215705104424/unknown.png", "https://www.metro.cl/estacion/isometricas/plaza-egana-l3.pdf"],

  "fernando castillo velasco" : ["https://cdn.discordapp.com/attachments/792250794296606743/908859405590724638/unknown.png", "https://www.metro.cl/estacion/isometricas/fernando-castillo-velasco.pdf"],

  "tobalaba l4" : ["https://cdn.discordapp.com/attachments/792250794296606743/908851826403717150/unknown.png", "https://www.metro.cl/estacion/isometricas/tobalaba-l4.pdf"], 

  "cristobal colon" : ["https://media.discordapp.net/attachments/792250794296606743/908854140229283890/unknown.png", "https://www.metro.cl/estacion/isometricas/cristobal-colon.pdf"],

  "francisco bilbao" : ["https://cdn.discordapp.com/attachments/792250794296606743/908856952124227594/unknown.png", "https://www.metro.cl/estacion/isometricas/francisco-bilbao.pdf"],

  "principe de gales" : ["https://cdn.discordapp.com/attachments/792250794296606743/908860018990915594/unknown.png", "https://www.metro.cl/estacion/isometricas/principe-de-gales.pdf"],

  "simon bolivar" : ["https://media.discordapp.net/attachments/792250794296606743/908857122673020978/unknown.png", "https://www.metro.cl/estacion/isometricas/simon-bolivar.pdf"],

  "grecia" : ["https://cdn.discordapp.com/attachments/792250794296606743/908861117399449600/unknown.png", "https://www.metro.cl/estacion/isometricas/grecia.pdf"],

  "plaza egana l4" : ["https://media.discordapp.net/attachments/792250794296606743/908856024662966302/unknown.png", "https://www.metro.cl/estacion/isometricas/plaza-egana.pdf"],

  "los orientales" : ["https://media.discordapp.net/attachments/792250794296606743/908857575217455134/unknown.png", "https://www.metro.cl/estacion/isometricas/los-orientales.pdf"],

  "los presidentes" : ["https://media.discordapp.net/attachments/792250794296606743/908862376680489011/unknown.png", "https://www.metro.cl/estacion/isometricas/los-presidentes.pdf"],

  "las torres" : ["https://cdn.discordapp.com/attachments/792250794296606743/908864139210936350/unknown.png", "https://www.metro.cl/estacion/isometricas/las-torres.pdf"],

  "macul" : ["https://cdn.discordapp.com/attachments/792250794296606743/908865928895295518/unknown.png", "https://www.metro.cl/estacion/isometricas/macul.pdf"],

  "vicuna mackenna l4" : ["https://cdn.discordapp.com/attachments/792250794296606743/908867496591888394/unknown.png", "https://www.metro.cl/estacion/isometricas/vicuna-mackenna-l4.pdf"],

  "vicente valdes l4" : ["https://cdn.discordapp.com/attachments/792250794296606743/908866748072210512/unknown.png", "https://www.metro.cl/estacion/isometricas/vicente-valdes-l4.pdf"],

  "rojas magallanes" : ["https://cdn.discordapp.com/attachments/792250794296606743/908869396502548530/unknown.png", "https://www.metro.cl/estacion/isometricas/rojas-magallanes.pdf"],

  "trinidad" : ["https://cdn.discordapp.com/attachments/792250794296606743/908869505411850280/unknown.png", "https://www.metro.cl/estacion/isometricas/trinidad.pdf"],

  "san jose de la estrella" : ["https://cdn.discordapp.com/attachments/792250794296606743/908869591923580968/unknown.png", "https://www.metro.cl/estacion/isometricas/san-jose-de-la-estrella.pdf"],

  "los quillayes" : ["https://cdn.discordapp.com/attachments/792250794296606743/908869677231525978/unknown.png", "https://www.metro.cl/estacion/isometricas/los-quillayes.pdf"],

  "elisa correa" : ["https://cdn.discordapp.com/attachments/792250794296606743/908869838313775144/unknown.png", "https://www.metro.cl/estacion/isometricas/elisa-correa.pdf"],

  "hospital sotero del rio" : ["https://cdn.discordapp.com/attachments/792250794296606743/908869943741784124/unknown.png", "https://www.metro.cl/estacion/isometricas/hospital-sotero-del-rio.pdf"],

  "protectora de la infancia" : ["https://cdn.discordapp.com/attachments/792250794296606743/908870029989249064/unknown.png", "https://www.metro.cl/estacion/isometricas/protectora-de-la-infancia.pdf"],

  "las mercedes" : ["https://cdn.discordapp.com/attachments/792250794296606743/908870141469667328/unknown.png", "https://www.metro.cl/estacion/isometricas/las-mercedes.pdf"],

  "plaza de puente alto" : ["https://cdn.discordapp.com/attachments/792250794296606743/908870285791494234/unknown.png", "https://www.metro.cl/estacion/isometricas/plaza-puente-alto.pdf"],

  "la cisterna l4a" : ["https://cdn.discordapp.com/attachments/792250794296606743/908865628440522762/unknown.png", "https://www.metro.cl/estacion/isometricas/la-cisterna-l4a.pdf"],

  "san ramon" : ["https://cdn.discordapp.com/attachments/792250794296606743/908866201160151080/unknown.png", "https://www.metro.cl/estacion/isometricas/san-ramon.pdf"],

  "santa rosa" : ["https://cdn.discordapp.com/attachments/792250794296606743/908871734575370240/unknown.png", "https://www.metro.cl/estacion/isometricas/santa-rosa.pdf"],

  "la granja" : ["https://cdn.discordapp.com/attachments/792250794296606743/908871634444746752/unknown.png", "https://www.metro.cl/estacion/isometricas/la-granja.pdf"],

  "santa julia" : ["https://cdn.discordapp.com/attachments/792250794296606743/908871501871214652/unknown.png", "https://www.metro.cl/estacion/isometricas/santa-julia.pdf"],

  "vicuna mackenna l4a" : ["https://cdn.discordapp.com/attachments/792250794296606743/908867760862400554/unknown.png", "https://www.metro.cl/estacion/isometricas/vicuna-mackenna-l4a.pdf"],

  "plaza de maipu" : ["https://media.discordapp.net/attachments/792250794296606743/908715734530654248/unknown.png", "https://www.metro.cl/estacion/isometricas/plaza-maipu.pdf"],

  "santiago bueras" : ["https://media.discordapp.net/attachments/792250794296606743/908716350883643472/unknown.png", "https://www.metro.cl/estacion/isometricas/santiago-bueras.pdf"],

  "del sol" : ["https://cdn.discordapp.com/attachments/792250794296606743/908703807314210886/unknown.png", "https://www.metro.cl/estacion/isometricas/del-sol.pdf"],

  "monte tabor" : ["https://media.discordapp.net/attachments/792250794296606743/908703129879580672/unknown.png", "https://www.metro.cl/estacion/isometricas/las-parcelas.pdf"],

  "las parcelas" : ["https://media.discordapp.net/attachments/792250794296606743/908703129879580672/unknown.png", "https://www.metro.cl/estacion/isometricas/las-parcelas.pdf"],

  "laguna sur" : ["https://cdn.discordapp.com/attachments/792250794296606743/908702776534634566/unknown.png", "https://www.metro.cl/estacion/isometricas/laguna-sur.pdf"],

  "barrancas" : ["https://media.discordapp.net/attachments/792250794296606743/908702330667560970/unknown.png", "https://www.metro.cl/estacion/isometricas/barrancas.pdf"],

  "pudahuel" : ["https://cdn.discordapp.com/attachments/792250794296606743/908701842739974154/unknown.png", "https://www.metro.cl/estacion/isometricas/pudahuel.pdf"],

  "san pablo l5" : ["https://media.discordapp.net/attachments/792250794296606743/908384392563535933/unknown.png", "https://www.metro.cl/estacion/isometricas/san-pablo-l5.pdf"],

  "lo prado" : ["https://media.discordapp.net/attachments/792250794296606743/908692168514887700/unknown.png", "https://www.metro.cl/estacion/isometricas/lo-prado.pdf"],

  "blanqueado" : ["https://media.discordapp.net/attachments/792250794296606743/908698562026676274/unknown.png", "https://www.metro.cl/estacion/isometricas/blanqueado.pdf"],

  "gruta de lourdes" : ["https://media.discordapp.net/attachments/792250794296606743/908698786342264852/unknown.png", "https://www.metro.cl/estacion/isometricas/gruta-de-lourdes.pdf"],

  "quinta normal" : ["https://media.discordapp.net/attachments/792250794296606743/908699194833911828/unknown.png", "https://www.metro.cl/estacion/isometricas/quinta-normal.pdf"],

  "cumming" : ["https://media.discordapp.net/attachments/792250794296606743/908699562510786570/unknown.png", "https://www.metro.cl/estacion/isometricas/cumming.pdf"],

  "santa ana l5" : ["https://media.discordapp.net/attachments/792250794296606743/908699944569946132/unknown.png", "https://www.metro.cl/estacion/isometricas/santa-ana-l5.pdf"],
  
  "plaza de armas l5" : ["https://media.discordapp.net/attachments/792250794296606743/908709572892586035/unknown.png", "https://www.metro.cl/estacion/isometricas/plaza-de-armas.pdf"],

  "bellas artes" : ["https://cdn.discordapp.com/attachments/792250794296606743/908714575233437716/unknown.png", "https://www.metro.cl/estacion/isometricas/bellas-artes.pdf"],

  "baquedano l5" : ["https://media.discordapp.net/attachments/792250794296606743/908717165224538182/unknown.png", "https://www.metro.cl/estacion/isometricas/baquedano-l5.pdf"],

  "parque bustamante" : ["https://media.discordapp.net/attachments/792250794296606743/908724041601396787/unknown.png", "https://www.metro.cl/estacion/isometricas/parque-bustamante.pdf"],

  "santa isabel" : ["https://media.discordapp.net/attachments/792250794296606743/908727745603833926/unknown.png", "https://www.metro.cl/estacion/isometricas/santa-isabel.pdf"],

  "irarrazaval l5" : ["https://media.discordapp.net/attachments/792250794296606743/908727937296130088/unknown.png", "https://www.metro.cl/estacion/isometricas/irarrazaval.pdf"],

  "nuble l5" : ["https://media.discordapp.net/attachments/792250794296606743/908733520833310870/unknown.png", "https://www.metro.cl/estacion/isometricas/nuble.pdf"],

  "rodrigo de araya": ["https://media.discordapp.net/attachments/792250794296606743/908841753069649930/unknown.png", "https://www.metro.cl/estacion/isometricas/rodrigo-de-araya.pdf", "San Joaquín"],

  "carlos valdovinos" : ["https://media.discordapp.net/attachments/792250794296606743/908850391691694170/unknown.png", "https://www.metro.cl/estacion/isometricas/carlos-valdovinos.pdf"],

  "camino agricola" : ["https://cdn.discordapp.com/attachments/792250794296606743/908854430177312788/unknown.png", "https://www.metro.cl/estacion/isometricas/camino-agricola.pdf"],

  "san joaquin" : ["https://cdn.discordapp.com/attachments/792250794296606743/908857970920661012/unknown.png", "https://www.metro.cl/estacion/isometricas/san-joaquin.pdf"],

  "pedrero" : ["https://cdn.discordapp.com/attachments/792250794296606743/908860904521744434/unknown.png", "https://www.metro.cl/estacion/isometricas/pedrero.pdf"],

  "mirador" : ["https://cdn.discordapp.com/attachments/792250794296606743/908862787067994112/unknown.png", "https://www.metro.cl/estacion/isometricas/mirador.pdf"],

  "bellavista de la florida" : ["https://cdn.discordapp.com/attachments/792250794296606743/908864624676454451/unknown.png", "https://www.metro.cl/estacion/isometricas/bellavista-de-la-florida.pdf"],

  "vicente valdes l5" : ["https://cdn.discordapp.com/attachments/792250794296606743/908866506895527996/unknown.png", "https://www.metro.cl/estacion/isometricas/vicente-valdes-l5.pdf"],

  "cerrillos" : ["https://cdn.discordapp.com/attachments/792250794296606743/908851111916630056/unknown.png", "https://www.metro.cl/estacion/isometricas/cerrillos.pdf"],

  "lo valledor" : ["https://media.discordapp.net/attachments/792250794296606743/908842183107424266/unknown.png", "https://www.metro.cl/estacion/isometricas/lo-valledor.pdf"],

  "pedro aguirre cerda" : ["https://media.discordapp.net/attachments/792250794296606743/908734729078063104/unknown.png", "https://www.metro.cl/estacion/isometricas/pedro-aguirre-cerda.pdf"],

  "franklin l6" : ["https://media.discordapp.net/attachments/792250794296606743/908731411211628544/unknown.png", "https://www.metro.cl/estacion/isometricas/franklin-l6.pdf"],

  "bio bio" : ["https://cdn.discordapp.com/attachments/792250794296606743/908734415256039564/unknown.png", "https://www.metro.cl/estacion/isometricas/bio-bio.pdf"],

  "nuble l6" : ["https://media.discordapp.net/attachments/792250794296606743/908733806477996032/unknown.png", "https://www.metro.cl/estacion/isometricas/nuble-l6.pdf"],

  "estadio nacional" : ["https://media.discordapp.net/attachments/792250794296606743/908735053641711636/unknown.png", "https://www.metro.cl/estacion/isometricas/estadio-nacional.pdf"],

  "nunoa l6" : ["https://media.discordapp.net/attachments/792250794296606743/908817690339192882/unknown.png", "https://www.metro.cl/estacion/isometricas/nunoa-l6.pdf"],

  "ines de suarez" : ["https://cdn.discordapp.com/attachments/792250794296606743/908842556706660352/unknown.png", "https://www.metro.cl/estacion/isometricas/ines-de-suarez.pdf"],

  "los leones l6" : ["https://media.discordapp.net/attachments/792250794296606743/908843419131080764/unknown.png", "https://www.metro.cl/estacion/isometricas/los-leones-l6.pdf"]

  }


stationsData = { 

  "san pablo l1" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Todos los Ascensores Disponibles","San Camilo", "MetroArte, Bibliometro, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/900527520393363526/unknown.png?width:312&height:468", "Lo Prado"],

  "neptuno" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Rampa de acceso ubicada en Av. Neptuno (vereda poniente) con Dorsal.", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/900532500273700954/unknown.png", "Lo Prado"],

  "pajaritos" : ["Buses, Aeropuerto", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Acceso a nivel de calle en Av. General Óscar Bonilla.", "Xs Market, Chilexpress, Coffee Market, INDAP, San Camilo, Dunkin Donuts, Dolce Mondo, KFC, K Cinco-SED, Cruz Verde, Baños Pajaritos", "Bibliometro, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/900535171583995944/unknown.png", "Lo Prado"],

  "las rejas" : ["Aeropuerto",  "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Ascensor de acceso ubicado en Av. Alameda Libertador Bernardo O'Higgins (vereda sur, entre ambos accesos).\n- Ascensor de acceso ubicado en Av. Alameda Libertador Bernardo O'Higgins (vereda norte) con Av. María Rozas Velásquez.", "K Cinco-SED", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/900535959903428649/unknown.png", "Lo Prado, Estación Central"],

  "ecuador" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Ascensor de acceso ubicado en Av. Alameda Libertador Bernardo O'Higgins (vereda sur) frente a Instituto Teletón Santiago.", "None", "MetroArte, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/900536593511776286/unknown.png", "Estación Central"],

  "san alberto hurtado" : ["Aeropuerto", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Ascensor de acceso ubicado en Av. Alameda Libertador Bernardo O'Higgins (vereda norte) con Toro Mazote.","None", "MetroArte, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/900537282317148170/unknown.png", "Estación Central"],

  "universidad de santiago" : ["Buses, Aeropuerto", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Ascensor de acceso ubicado en Av. Alameda Libertador Bernardo O'Higgins (vereda sur, frente a terminal de buses).","None", "MetroArte, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/900537700057231430/unknown.png", "Estación Central"],

  "estacion central" : ["Tren, Buses, Aeropuerto", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Ascensor de acceso ubicado en Av. Alameda Libertador Bernardo O'Higgins (vereda sur) en acceso Estación Alameda (EFE).","Coffee Market", "MetroArte, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/900912304999268432/unknown.png?width:454&height:468", "Estación Central, Santiago Centro"],

  "union latinoamericana" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Ascensor de acceso ubicado en Av. Alameda Libertador Bernardo O'Higgins (vereda sur) con Abate Molina.","None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/900913086343548958/unknown.png", "Santiago Centro"],

  "republica" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Ascensor de acceso ubicado en Av. Alameda Libertador Bernardo O'Higgins (vereda norte, detrás del acceso).","None", "MetroArte, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/900913581288202251/unknown.png", "Santiago Centro"],

  "los heroes l1" : ["Buses, Aeropuerto", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Ascensor de acceso ubicado en Av. Alameda Libertador Bernardo O'Higgins (vereda sur) con Av. Ejército Libertador por Línea 1.","None", "MetroArte, Bibliometro, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/900918395036397588/unknown.png", "Santiago Centro"],

  "la moneda" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Ascensor de acceso ubicado en Av. Alameda Libertador Bernardo O'Higgins (vereda sur) con Nataniel Cox (detrás del acceso).","Savory, Maxi-k, Xs Market, Patagonia Donuts, Audiomobile, San Camilo, Monarch, Chilexpress, Solo Tú, Ideal", "MetroArte, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/900920941251534858/unknown.png", "Santiago Centro"],

  "universidad de chile l1" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Ascensor de acceso ubicado en Av. Alameda Libertador Bernardo O'Higgins (vereda sur) con Arturo Prat por Línea 1. **Advertencia: Por reparaciones, hay un ascensor que no está disponible. Última actualización: 20/10/2021**","Castaño, Piwen, Kino (D. Bartik), Cruz Verde, Correos de Chile, OxxoPiwen, Subway, San Camilo, Xs Market (módulo), Ortopedica, Todo Cel, Xs Market, Chilexpress, Synetlink, Costanera Norte, Parque del Recuerdo, Equifax, Bellota, Asia Maletería, Cerrotorres, Monarch, Audiomobile", "MetroArte, Bibliometro, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/900922370406117426/unknown.png?width:559&height:468", "Santiago Centro"],

  "santa lucia" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Ascensor de acceso ubicado en Av. Alameda Libertador Bernardo O'Higgins (vereda norte) con Miraflores.\n- **Advertencia: Por reparaciones, el ascensor no está disponible. Última actualización: 20/10/2021**","Oasis", "MetroArte, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/900926080054099968/unknown.png", "Santiago Centro"],

  "universidad catolica" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Ascensor de acceso ubicado en Av. Alameda Libertador Bernardo O'Higgins (vereda sur).","Subexpress, Onecase", "MetroArte, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/900926539208720446/unknown.png", "Santiago Centro"],

  "baquedano l1" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Ascensor de acceso ubicado entre Av. General Bustamante y Ramón Carnicer (frente a Parque Bustamante).\n**- Advertencia: Por reparaciones, este ascensor no está disponible. Última actualización: 20/10/2021**","Maxi-K", "MetroArte, Bibliometro, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/900927104944857148/unknown.png", "Santiago Centro, Providencia"],

  "salvador" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Ascensor de acceso ubicado en Av. Providencia (vereda sur) con General Salvo.\n- Ascensor de acceso ubicado en Parque Balmaceda (acceso principal).","Minimarket Gloria", "MetroArte, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/900929713789345792/unknown.png?width:734&height:468", "Providencia"],

  "manuel montt" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Ascensor de acceso ubicado en Av. Providencia (vereda sur, detrás del acceso).", "Castaño, Xs Market, Piwen", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/900930010213408839/unknown.png", "Providencia"],

  "pedro de valdivia" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Av. Providencia (vereda sur) con Marchant Pereira.", "Monarch, Xs Market, Ideal, Audiomobile, McDonald's, Sori, Passion, Choc Lover", "MetroArte, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/900930386186600498/unknown.png", "Providencia"],

  "los leones l1" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Ascensor de acceso ubicado en Av. Nueva Providencia con Av. Suecia por Línea 1.\n:\n- Ascensor de acceso ubicado en Av. Suecia con General Holley (vereda oriente) por Línea 6.\n**-Advertencia: El ascensor hacia andenes se encuentra fuera de servicio. Última actualización: 20/10/2021**", "McDonald's", "MetroArte, Metroinforma", "https://cdn.discordapp.com/attachments/792250794296606743/901594611166871592/unknown.png", "Providencia"],

  "tobalaba l1" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Ascensor de acceso ubicado en Av. Nueva Providencia con Av. Providencia (vereda norte) por Línea 4.\n- Ascensor de acceso ubicado en Av. Tobalaba con Av. Providencia (vereda sur) por Línea 4.", "Piwen, Topcel, Check Inn, Subway, Castaño, Serviestado, Monarch, Fanty, Turbus, Equifax, Servipag, Savory", "Bibliometro, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/900938632548986981/unknown.png", "Providencia"],

  "el golf" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Av. Apoquindo (vereda sur).", "Antojito, Maxi-K", "MetroArte, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901087583898075217/unknown.png", "Las Condes"],

  "alcantara" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Alcántara con Av. Apoquindo (vereda sur).", "None", "MetroArte, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901088024417411132/unknown.png", "Las Condes"],

  "escuela militar" : ["Bicimetro", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Ascensor de acceso ubicado en Av. Américo Vespucio (vereda oriente) con Los Militares (detrás de paraderos, ingreso por Galería Comercial).\n- Ascensor de acceso ubicado en Av. Américo Vespucio (vereda poniente) con Los Militares (detrás de paraderos, ingreso por Galería Comercial).", "Xs Market, Maxi-K, INDAP", "MetroArte, Bibliometro, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901088232450703360/unknown.png", "Las Condes"],

  "manquehue": ["None", "Máquinas de carga autoservicio, Redbanc", "- Ascensor de acceso ubicado en Av. Apoquindo (vereda norte) con O'Connell (detrás del acceso).\n- Ascensor de acceso ubicado en Av. Apoquindo (vereda sur) con Mar de los Sargazos.\n- **Advertencia: Por reparaciones, hay un ascensor que no está disponible. Última actualización: 20/10/2021**", "Xs Market, Maxi-K, Topcel, McDonald's", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901088857242611732/unknown.png", "Las Condes"],

  "hernando de magallanes" : ["None", "Redbanc, Teléfonos", "Ascensor de acceso ubicado en Av. Apoquindo con Hernando de Magallanes.", "None", "MetroArte, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901089799757242368/unknown.png", "Las Condes"],

  "los dominicos" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Av. Camino El Alba con Av. Apoquindo (detrás del acceso).", "None", "MetroArte, Bibliometro, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901089979009212476/unknown.png", "Las Condes"],

  "la cisterna l2" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Ascensor de acceso ubicado en Gran Avenida José Miguel Carrera (vereda oriente) con Av. Ossa por Intermodal y Línea 2.\n- Ascensor de acceso ubicado en Carlos Biaut con Gran Avenida José Miguel Carrera (vereda poniente) por Línea 4A.\n- Ascensor de acceso ubicado en Av. Américo Vespucio con Corredor Gran Avenida (vereda poniente, detrás del acceso) por Línea 4A.\n- Ascensor de acceso ubicado en Av. Américo Vespucio con Corredor Gran Avenida (vereda oriente, detrás del acceso) por Línea 4A.", "Serviestado, Subway, Xs Market, Maxi-K", "Bibliometro, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901092557189181490/unknown.png", "La Cisterna"],

  "el parron" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Gran Avenida José Miguel Carrera (vereda oriente) con Av. El Parrón.", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901093962587185212/unknown.png", "La Cisterna"],

  "lo ovalle" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Gran Avenida José Miguel Carrera (vereda poniente).", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901094673270046720/unknown.png", "La Cisterna"],

  "ciudad del nino" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Gran Avenida José Miguel Carrera (vereda oriente).", "None", "MetroArte, Bibliometro, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901094930821308466/unknown.png", "San Miguel"],

  "departamental" : ["Buses, Aeropuerto", "Redbanc, Teléfonos", "Ascensor de acceso ubicado en Gran Avenida José Miguel Carrera (vereda oriente) con Calle 1.", "None", "Bibliometro, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901095317141860362/unknown.png", "San Miguel"],

  "lo vial" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Av. José Miguel Carrera (vereda poniente).", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901095698773184542/unknown.png", "San Miguel"],

  "san miguel" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Llano Subercaseaux con Arcangel (frente a los accesos).", "Delicias Santa Lucía", "Bibliometro, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901096083869032448/unknown.png", "San Miguel"],

  "el llano" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Gran Avenida José Miguel Carrera (vereda oriente).", "Maxi-K", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901096616990216223/unknown.png", "San Miguel"],

  "franklin l2" : ["None", "Redbanc, Teléfonos", "- Ascensor de acceso ubicado en Placer con Nataniel Cox por Intermodal y Línea 2.\n- Ascensor de acceso ubicado en Centenario con San Diego (detrás del acceso) por Línea 6.", "Xs Market", "MetroArte, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901654504854945802/unknown.png", "Santiago Centro", "Santiago Centro"],

  "rondizzoni" : ["None", "Redbanc, Teléfonos", "Rampa de acceso ubicada en General Rondizonni (vereda sur) con Av. Viel.", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901831110848282634/unknown.png", "Santiago Centro"],

  "parque ohiggins" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Av. Viel con Av. El Parque / Av. Manuel Antonio Matta.", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901831439732076544/unknown.png", "Santiago Centro"],

  "toesca" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Rampa de acceso ubicada en Av. Manuel Rodríguez con Santa Isabel (vereda norte).", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901831569646432306/unknown.png", "Santiago Centro"],

  "los heroes l2" : ["Bicimetro", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "None","Dulce y Travesura, Los Cerezos", "Metroinforma", "None", "Santiago Centro"],

  "santa ana l2" : ["None", "Redbanc, Teléfonos", "- Rampa de acceso ubicada en Santo Domingo con Av. Manuel Rodríguez por Línea 2.\n- Rampa de acceso ubicada en Compañía de Jesús con Av. Manuel Rodríguez por Línea 2.\n- Ascensor de acceso ubicado en San Martín con Catedral (Plaza Santa Teresa de Los Andes) por Línea 5.\n**- Advertencia: Por reparaciones, hay un ascensor que no está disponible. Última actualización: 20/10/2021**", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901832165053059113/unknown.png", "Santiago Centro"],

  "puente cal y canto l2" : ["None", "Máquinas de carga autoservicio, Oficina de Atención a Clientes, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Av. General Mackenna con Paseo Puente (a un costado del acceso) por Línea 2.", "None", "MetroArte, Bibliometro, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901832808073408562/unknown.png", "Santiago Centro"],

  "patronato" : ["Buses, Intermodales, Bicimetro", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en General de la Lastra frente a Mall.", "None", "Bibliometro, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901833425248452698/unknown.png", "Recoleta"],

  "cerro blanco" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Av. Recoleta entre Dr. Raimundo Charlin y Santos Dumont.", "Subexpress", "MetroArte, Bibliometro, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901833690521407528/unknown.png", "Recoleta"],

  "cementerios" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Av. Recoleta (vereda poniente) detrás de acceso a estación.", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901833902023389194/unknown.png", "Recoleta"],

  "einstein" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Av. Einstein con Av. Recoleta.", "Xs Market", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901834124946468884/unknown.png", "Recoleta"],

  "dorsal" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Av. Dorsal con Av. Recoleta.", "Subexpress", "Bibliometro, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901834366324473867/unknown.png", "Recoleta"],

  "zapadores" : ["None", "Redbanc, Teléfonos", "Ascensor de acceso ubicado en Av. Recoleta con Av. Los Zapadores.", "Magnolia", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901834630494318632/unknown.png", "Recoleta"],

  "vespucio norte" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Av. Principal Capitán Ignacio Carrera Pinto.", "Magnolia, Xs Market, Binario, Perfumería Bicentenario, Xs MarketBaños Vespucio Norte", "MetroArte, Bibliometro, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901834914956197959/unknown.png", "Huechuraba, Recoleta"],

  "los libertadores" : ["None", "Máquinas de carga autoservicio, Redbanc", "Ascensor de acceso ubicado en General San Martín con Av. Américo Vespucio.", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901934822388269146/unknown.png", "Quilicura"],

  "cardenal caro" : ["None", "Máquinas de carga autoservicio, Redbanc", "Ascensor de acceso ubicado en Av. Independencia con Av. Cardenal José María Caro.", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901935169949270026/unknown.png", "Conchalí"],

  "vivaceta" : ["None", "Máquinas de carga autoservicio, Redbanc", "Ascensor de acceso ubicado en Av. Independencia con Vecinal.", "Maxi-K, Máquinas de Vending", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901935440238616607/unknown.png", "Conchalí"],

  "conchali" : ["None", "Máquinas de carga autoservicio, Redbanc", "Ascensor de acceso ubicado en Av. Independencia con Av. Dorsal.", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901935753897066496/unknown.png", "Conchalí"],

  "plaza chacabuco" : ["None", "Máquinas de carga autoservicio, Redbanc", "Ascensor de acceso ubicado en Av. Independencia con Santa Laura.", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901936023263674408/unknown.png", "Independencia"],

  "hospitales" : ["None", "Máquinas de carga autoservicio, Redbanc", "Ascensor de acceso ubicado en Profesor Alberto Zañartu con Av. Independencia.", "None", "MetroArte, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901936228373528636/unknown.png", "Independencia"],

  "puente cal y canto l3" : ["Lineacero", "Máquinas de carga autoservicio, Redbanc", "None", "Xs Market, Oxxo, Máquinas de Vending", "Metroinforma", "None", "Santiago Centro"],

  "plaza de armas l3" : ["None", "Máquinas de carga autoservicio, Redbanc", "- Acceso a nivel de calle en Bandera con Catedral por Línea 3.\n- Ascensor de acceso ubicado en Paseo 21 de mayo con Monjitas por Línea 5.\n**-  Advertencia: Por reparaciones, hay un ascensor que no está disponible. Última actualización: 21/10/2021**", "Xs Market, Máquinas de Vending", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901936475992629249/unknown.png", "Santiago Centro"],

  "universidad de chile l3" : ["None", "Máquinas de carga autoservicio, Redbanc", "None","None", "Metroinforma", "None", "Santiago Centro"],

  "parque almagro" : ["Lineacero", "Máquinas de carga autoservicio, Redbanc", "Ascensor de acceso ubicado en San Diego con Mencía de los Nidos.", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901937439646576640/unknown.png", "Santiago Centro"],

  "matta" : ["Lineacero", "Máquinas de carga autoservicio, Redbanc", "Ascensor de acceso ubicado en Av. Manuel Antonio Matta con Av. Santa Rosa.", "OK Market, Máquinas de Vending", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901937656433356921/unknown.png", "Santiago Centro"],

  "irarrazaval l3" : ["None", "Máquinas de carga autoservicio, Redbanc", "- Ascensor de acceso ubicado en Matta Oriente con Av. San Eugenio por Línea 3.\n- Ascensores ubicados en Parque Bustamante frente a acceso Pedro de Oña por Línea 5.", "Castaño, Máquinas de Vending", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901938132759482378/unknown.png", "nunoa"],

  "monsenor eyzaguirre" : ["None", "Máquinas de carga autoservicio, Redbanc", "Ascensor de acceso ubicado en Av. Irarrázaval con Monseñor Eyzaguirre.", "San Camilo, Xs Market, Máquinas de Vending", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901938687481380914/unknown.png", "nunoa"],

  "nunoa l3" : ["None", "Máquinas de carga autoservicio, Redbanc", "Ascensor de acceso ubicado en Av. Pedro de Valdivia con Av. Irarrázaval (costado izquierdo del acceso).", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901938959670714368/unknown.png", "nunoa"],

  "chile espana" : ["None", "Máquinas de carga autoservicio, Redbanc", "Ascensor de acceso ubicado en Av. Irarrázaval con Av. José Pedro Alessandri.", "OK Market, Máquinas de Vending", "MetroArte, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901939550618804314/unknown.png", "nunoa"],

  "villa frei" : ["None", "Máquinas de carga autoservicio, Redbanc", "Ascensor de acceso ubicado en Av. Irarrázaval con Ramón Cruz.", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901939840092868638/unknown.png", "nunoa"],

  "plaza egana l3" : ["None", "Máquinas de carga autoservicio, Oficina de Atención a Clientes, Redbanc", "Ascensor de acceso ubicado en el centro de la Plaza Egaña por Línea 3.", "Castaño, Patagonia Donuts, Máquinas de Vending", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901940118942797824/unknown.png", "nunoa, La Reina"],

  "fernando castillo velasco" : ["Lineacero", "Máquinas de carga autoservicio, Redbanc", "Ascensor de acceso ubicado en Av. Alcalde Fernando Castillo Velasco con Av. Tobalaba.", "Xs Market, Máquinas de Vending", "MetroArte, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/901940804799561748/unknown.png", "La Reina"],

  "tobalaba l4" : ["None", "Redbanc, Teléfonos", "None", "Pipipau, Xs Market, Piwen, Maxi-K, Antojito, Chilexpress", "MetroArte, Metroinforma", "None", "Providencia"],

  "cristobal colon" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Av. Eliodoro Yáñez con Av. Tobalaba (vereda poniente).", "None", "MetroArte, Bibliometro, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902260666373644298/unknown.png", "Providencia"],

  "francisco bilbao" : ["None", "Redbanc, Teléfonos", "Ascensor de acceso ubicado en Av. Tobalaba (vereda poniente) con Av. Francisco Bilbao.", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902261432303878165/unknown.png", "Providencia"],

  "principe de gales" : ["Bicimetro", "Redbanc, Teléfonos", "Ascensor de acceso ubicado entre Av. Tobalaba y Av. Ossa (vereda oriente).", "Subexpress", "MetroArte, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902267738330894336/unknown.png", "nunoa, La Reina"],

  "simon bolivar" : ["Bicimetro", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Av. Ossa (vereda oriente) con Av. Echeñique.", "Subexpress", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902268067529256980/unknown.png", "nunoa, La Reina"],

  "plaza egana l4" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "None", "None", "Bibliometro, Metroinforma", "None", "nunoa"],

  "los orientales" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Av. Américo Vespucio (vereda oriente) con Av. Oriental.", "None", "MetroArte, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902278217426145330/unknown.png", "nunoa, Peñalolén"],

  "grecia" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Ascensor de acceso ubicado en Av. Egaña con Av. Grecia Oriente (detrás del acceso).\n- Ascensor de acceso ubicado en Av. Grecia Oriente (vereda sur, detrás del acceso).", "Maxi-K", "MetroArte, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902279168555880529/unknown.png", "Macul, Ñuñoa, Peñalolén"],

  "los presidentes" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Ascensor de acceso ubicado en Hermano Martín Panero con Av. Américo Vespucio.\n- Ascensor de acceso ubicado en Av. Los Presidentes con Av. Américo Vespucio.", "Bibliometro, Metroinforma", "Bibliometro,Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902280468584599572/unknown.png", "Macul, Peñalolén"],

  "quilin" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Ascensor de acceso ubicado en Av. Quilín con Av. Américo Vespucio (vereda oriente).\n- Ascensor de acceso ubicado en Av. Quilín con Av. Américo Vespucio (vereda poniente).", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902281269214343239/unknown.png", "Macul, Peñalolén"],

  "las torres" : ["None", "Redbanc, Teléfonos", "- Ascensor de acceso ubicado en Av. Américo Vespucio (vereda poniente) con Av. Dr. Amador Neghme Rodríguez.\n- Ascensor de acceso ubicado en Av. Américo Vespucio (vereda oriente) con Av. Las Torres.", "None", "Bibliometro, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902281949484310558/unknown.png", "Macul, Peñalolén"],

  "macul" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Rampa de acceso ubicada en Américo Vespucio con Av. Macul / Av. La Florida (a un costado del acceso).\n- Rampa de acceso ubicada en Av. Américo Vespucio con Av. Departamental (a un costado del acceso).", "None", "Bibliometro, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902282395657568328/unknown.png", "La Florida, Macul, Peñalolén"],

  "vicuna mackenna l4" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Rampa de acceso ubicada en Av. Américo Vespucio con Julio Vildósola.", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902282788588372028/unknown.png", "La Florida"],
  
  "vicente valdes l4" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Ascensor de acceso ubicado en Av. Vicuña Mackenna (vereda oriente) con Vicente Valdés por Línea 4.\n- Ascensor de acceso ubicado en Av. Vicuña Mackenna (vereda poniente) con Don Pepe por Línea 4.", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902283837948702830/unknown.png", "La Florida"],

  "rojas magallanes" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Rojas Magallanes con Av. Vicuña Mackenna.", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902284496420884580/unknown.png", "La Florida"],
  
  "trinidad" : ["Redbanc, Teléfonos", "None", "Ascensor de acceso ubicado en Av. Trinidad con Av. Vicuña Mackenna.", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902284817931075634/unknown.png", "La Florida"],

  "san jose de la estrella" : ["None", "Redbanc, Teléfonos", "Ascensor de acceso ubicado en Av. San José de la Estrella con Av. Vicuña Mackenna.", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902285053684510750/unknown.png", "La Florida"],

  "los quillayes" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en María Elena con Av. Vicuña Mackenna.", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902285326310055946/unknown.png", "La Florida"],

  "elisa correa" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Elisa Correa Sanfuentes con Av. Concha y Toro.", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902286090973642832/unknown.png", "Puente Alto"],

  "hospital sotero del rio" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Ascensor de acceso ubicado en Av. Concha y Toro (vereda poniente, detrás del acceso).\n- Ascensor de acceso ubicado en Av. Concha y Toro (vereda oriente, detrás del acceso).", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902286429097435156/unknown.png", "Puente Alto"],

  "protectora de la infancia" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Av. Concha y Toro con Ángel Pimentel.", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902286903817158676/unknown.png", "Puente Alto"],

  "las mercedes" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Av. Concha y Toro (vereda oriente).", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902287613124296784/unknown.png", "Puente Alto"],

  "plaza de puente alto" : ["Intermodales", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Manuel Rodríguez con Av. Concha y Toro (en la Plaza).", "Maxi-K, McDonald's, Piwen, Xs Market, Cruz Verde, Pc Print", "MetroArte, Bibliometro, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902288428908048414/unknown.png", "Puente Alto"],

  "vicuna mackenna l4a" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "None", "None", "Metroinforma", "None", "La Florida"],

  "santa julia" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Ascensor de acceso ubicado en Av. Américo Vespucio (vereda poniente) con Santa Julia.\n- Ascensor de acceso ubicado en Av. Américo Vespucio (vereda oriente) con Santa Julia.", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902290114670133268/unknown.png", "La Florida"],
  
  "la granja" : ["Bicimetro", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Ascensor de acceso ubicado en Av. Américo Vespucio (vereda norte) con Coronel.\n- Ascensor de acceso ubicado en Av. Américo Vespucio (vereda sur) con Coronel.", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902290621958619147/unknown.png", "La Granja"],

  "santa rosa" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Ascensor de acceso ubicado en Av. Américo Vespucio con Av. Santa Rosa (vereda poniente).\n- Ascensor de acceso ubicado en Av. Américo Vespucio con Corredor Santa Rosa (vereda poniente).\n- Ascensor de acceso ubicado en Av. Américo Vespucio con Corredor Santa Rosa (vereda oriente).\n- Ascensor de acceso ubicado en Av. Américo Vespucio con Av. Santa Rosa (vereda oriente).", "San Camilo, Maxi-K, Onecase", "Bibliometro, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902291044882862121/unknown.png", "La Granja, San Ramón"],

  "san ramon" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Ascensor de acceso ubicado en Av. Américo Vespucio (vereda norte) con Carlos Dávila.\n- Ascensor de acceso ubicado en Av. Américo Vespucio (vereda sur) con Parque La Bandera.", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902291279189266432/unknown.png", "San Ramón"],

  "la cisterna l4a" : ["None", "Redbanc, Teléfonos", "None", "Cinnabon, Underground, McDonald's, XsMarket, Coffee Market, Liga Chilena, Subway, San Camilo, Maxi-K", "Metroinforma", "None", "La Cisterna"],

  "plaza de maipu" : ["Intermodales", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Av. Pajaritos (vereda oriente) con Av. 5 de abril (entre ambos accesos).", "None", "MetroArte, Bibliometro, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902351250824261632/unknown.png", "Maipú"],

  "santiago bueras" : ["None", "Redbanc, Teléfonos", "Acceso a nivel de calle en Av. Pajaritos (vereda oriente).", "San Camilo", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902351473533407232/unknown.png", "Maipú"],

  "del sol" : ["Intermodales", "Máquinas de carga autoservicio, Redbanc", "- Ascensor de acceso ubicado en Isabel Riquelme con Juan José Rivera (acceso peatonal).\n- Ascensor de acceso ubicado en Intermodal Del Sol (acceso desde buses).", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902352156999438386/unknown.png", "Maipú"],

  "monte tabor" : ["None", "Redbanc, Teléfonos", "Acceso a nivel de calle en Av. Pajaritos con Monte Tabor.", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902352420414312548/unknown.png", "Maipú"],

  "las parcelas" : ["None", "Redbanc, Teléfonos", "Acceso a nivel de calle en Av. Pajaritos con Arquitecto Hugo Bravo.", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902352636043485234/unknown.png", "Maipú"],

  "laguna sur" : ["None", "Máquinas de carga autoservicio, Redbanc", "- Acceso a nivel de calle en Teniente Cruz (vereda poniente) con Av. Laguna Sur.\n- Advertencia: Por reparaciones, hay un ascensor que no está disponible. Última actualización: 20/10/ 2021", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902352935869091920/unknown.png", "Pudahuel"],

  "barrancas" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Av. General Óscar Bonilla (vereda sur) con Teniente Cruz.", "None", "Bibliometro, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902353398228209755/unknown.png", "Pudahuel"],

  "pudahuel" : ["Bicimetro", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Acceso a nivel de calle en Av. San Pablo (vereda sur).", "San Camilo", "MetroArte, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902353638532452352/unknown.png", "Pudahuel"],

  "san pablo l5" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "None","None", "MetroArte, Metroinforma", "Lo Prado"],

  "lo prado" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Av. San Pablo (vereda norte).", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902354164514947092/unknown.png", "Lo Prado"],

  "blanqueado" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Acceso a nivel de calle en Av. San Pablo (vereda norte) con Sergio Valdovinos.", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902354558146195507/unknown.png", "Quinta Normal"],

  "gruta de lourdes" : ["None", "Redbanc, Teléfonos", "Acceso a nivel de calle en Av. San Pablo (vereda sur) con Patria Nueva.", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902354795552194630/unknown.png", "Quinta Normal"],

  "quinta normal" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Ascensor de acceso ubicado en Av. Matucana (vereda poniente).\n**- Advertencia: Por reparaciones, hay un ascensor que no está disponible. Última actualización: 20/10/2021**", "None", "MetroArte, Bibliometro, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902355213149700116/unknown.png", "Santiago Centro"],

  "cumming" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Catedral con Ricardo Cumming (vereda poniente).", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902355462085808178/unknown.png", "Santiago Centro"],

  "santa ana l5" : ["None", "Redbanc, Teléfonos", "None", "None", "MetroArte, Metroinforma", "None", "Santiago Centro"],

  "plaza de armas l5" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "None", "None", "MetroArte, Bibliometro, Metroinforma", "None", "Santiago Centro"],

  "bellas artes" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Monjitas con Mosqueto.", "None", "MetroArte, Bibliometro, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902356180511375460/unknown.png", "Santiago Centro"],

  "baquedano l5" : ["None", "Oficina de Atención a Clientes, Redbanc, Teléfonos", "None","Xs Market, Pipipau, Topcel, Piwen", "MetroArte, Metroinforma", "None", "Santiago Centro, Providencia"], 

  "parque bustamante" : ["Intermodales", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Av. Francisco Bilbao (vereda sur) con Ramón Carnicer.", "None", "MetroArte, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902356417904787466/unknown.png", "Providencia"],

  "santa isabel" : ["Lineacero", "Redbanc, Teléfonos", "Ascensor de acceso ubicado en Av. General Bustamante (vereda poniente) con Santa Isabel.", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902356637984104518/unknown.png", "Providencia"],

  "irarrazaval l5" : ["Intermodales, Bicimetro", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "None", "Xs Market, San Camilo, Maxi-K", "Bibliometro, Metroinforma", "None", "nunoa"],

  "nuble l5" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Acceso a nivel de calle en Av. Vicuña Mackenna (vereda oriente) con Carlos Dittborn.", "None", "Bibliometro, Metroinforma", "https://cdn.discordapp.com/attachments/792250794296606743/902357074720210994/unknown.png", "nunoa"],

  "rodrigo de araya" : ["None", "Redbanc, Teléfonos", "Ascensor de acceso ubicado en Av. Vicuña Mackenna con Santa Elena / Juan Mitjans.", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902357557845307443/unknown.png", "San Joaquín, Macul"],

  "carlos valdovinos" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado entre Av. Vicuña Mackenna Oriente y Poniente (en acceso principal).", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902357801379192832/unknown.png", "San Joaquín, Macul"],

  "camino agricola" : ["None", "Redbanc, Teléfonos", "Ascensor de acceso ubicado en Av. Vicuña Mackenna con El Pinar / Av. Escuela Agrícola.", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902358026231627806/unknown.png", "San Joaquín, Macul"],

  "san joaquin" : ["None", "Redbanc, Teléfonos", "Acceso a nivel de calle en Av. Vicuña Mackenna.", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902358246097035274/unknown.png", "San Joaquín, Macul"],

  "pedrero" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Antonio Acevedo Hernández (a un costado del acceso).", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902358536380620800/unknown.png", "San Joaquín, Macul"],

  "mirador" : ["None", "Redbanc, Teléfonos", "Ascensor de acceso ubicado en Av. Vicuña Mackenna Oriente con Mirador Azul.", "None", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902358813183709184/unknown.png", "La Florida"],

  "bellavista de la florida" : ["Bicimetro", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "- Ascensor de acceso ubicado en Av. Vicuña Mackenna Oriente con Serafín Zamora (vereda poniente, dirección Vicente Valdés).\n- Ascensor de acceso ubicado en Av. Vicuña Mackenna Oriente con Serafín Zamora (vereda oriente, dirección Plaza de Maipú).", "Xs Market, Subexpress, Pc Expert, Maxi-K, San Camilo", "Bibliometro, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902359145787842630/unknown.png", "La Florida"],

  "vicente valdes l5" : ["None", "Máquinas de carga autoservicio, Redbanc", "None", "None", "Bibliometro, Metroinforma", "None", "La Florida"],

  "cerrillos" : ["Lineacero", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Av. Departamental (vereda norte) con Buzeta (al costado izquierdo del acceso).", "None", "MetroArte, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902361708562100275/unknown.png", "Cerrillos"],

  "lo valledor" : ["tren", "Máquinas de carga autoservicio, Redbanc", "Ascensor de acceso ubicado en Av. Carlos Valdovinos con Av. Maipú (frente a Tren Central EFE).", "None", "MetroArte, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902362069549084692/unknown.png", "Pedro Aguirre Cerda"],

  "pedro aguirre cerda" : ["Lineacero", "Máquinas de carga autoservicio, Redbanc", "Ascensor de acceso ubicado en Av. Carlos Valdovinos con Club Hípico (al costado derecho del acceso).", "None", "Bibliometro, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902362283227873290/unknown.png", "Pedro Aguirre Cerda"],

  "franklin l6" : ["Lineacero", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "None", "Patagonia Donuts, Maxi-K, Oxxo, Dr. Simi, Castaño, Máquinas de Vending", "MetroArte, Bibliometro, Metroinforma", "None", "Santiago Centro, San Miguel"],

  "bio bio" : ["Lineacero", "Máquinas de carga autoservicio, Redbanc", "Ascensor de acceso ubicado en Centenario con Av. Santa Rosa (al costado derecho del acceso).", "None", "MetroArte, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902362510177472513/unknown.png", "Santiago Centro, San Joaquín, San Miguel"],

  "nuble l6" : ["None", "Máquinas de carga autoservicio, Redbanc", "None", "Maxi-K, Bon Bon", "Metroinforma", "None", "nunoa"],

  "estadio nacional" : ["None", "Máquinas de carga autoservicio, Redbanc", "Ascensor de acceso ubicado en Av. Grecia con Av. Pedro de Valdivia (detrás del acceso principal).", "Maxi-K", "Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902362966077366322/unknown.png", "nunoa"],

  "nunoa l6" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "None", "Carral, San Camilo, Maxi-K, Castaño, Xs Market, Oxxo, Cruz Verde, Máquinas de Vending", "Bibliometro, Metroinforma", "None", "nunoa"],

  "ines de suarez" : ["Lineacero", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "Ascensor de acceso ubicado en Av. Francisco Bilbao con Plaza Pedro de Valdivia (detrás del acceso).", "San Camilo, Máquinas de Vending", "Bibliometro, Metroinforma", "https://media.discordapp.net/attachments/792250794296606743/902363283871371354/unknown.png", "Providencia"],

  "los leones l6" : ["None", "Máquinas de carga autoservicio, Redbanc, Teléfonos", "None", "Oxxo, San Camilo , Trayecto Librería, KFC, Castaño, Cruz Verde, Ok Market, Máquinas de Vending", "MetroArte, Metroinforma", "None", "Providencia"]

  
}




# Combine all data into a single dictionary
data = {
    "schematics": stationsSchematics,
    "staticData": stationsData
}



# Function to generate a JSON file

def generate_json_file():

    # Define the JSON file name

    file_name = "stationsdata.json"

    # Write the data to the JSON file

    with open(file_name, "w") as json_file:

        json.dump(data, json_file, indent=4)

    print(f"JSON file '{file_name}' has been generated successfully.")

# Call the function to generate the JSON file


 generate_json_file()