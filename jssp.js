(function($){
  window.globals = [];

  $.fn.jssp=function(o){
    var params = o.settings || {};
    var $bypass = o.bypass || null;

    return this.each(function(){
      var audio = this;
      var processSP = function(data) {
        var FXs = {
          agc: function(ctx, input, settings) {
            var fx = ctx.createScriptProcessor(4096, 2, 2);
            var fxh = {};
            window.globals.push(fx);
            var speed = settings.speed;
            var userms = settings.type == 'rms';
            var maxgain = settings.maxgain;
            fxh.samplerate = ctx.sampleRate;
            fxh.rmsValues = [];
            fxh.rmsSize = 256; //samples
            fxh.rmsOldIndex = 1;
            fxh.rmsIndex = 0;
            fxh.rmsSum = 0;
            fxh.previousGain = 1.0;
            fxh.previousRms = 0.0;
            var getRMS = function(sample) {
          		var oldSample = +fxh.rmsValues[fxh.rmsOldIndex] || 0;
          		fxh.rmsValues[fxh.rmsIndex] = sample;
          		fxh.rmsIndex = (fxh.rmsIndex + 1) % fxh.rmsSize;
          		fxh.rmsOldIndex = (fxh.rmsOldIndex + 1) % fxh.rmsSize;
          		fxh.rmsSum = fxh.rmsSum + (sample * sample) - (oldSample * oldSample);
          		return Math.sqrt(fxh.rmsSum / fxh.rmsSize) || 0;
          	};
            fx.onaudioprocess = function(audioProcessingEvent) {
              var inputBuffer = audioProcessingEvent.inputBuffer;
              var outputBuffer = audioProcessingEvent.outputBuffer;
              var leftIn = inputBuffer.getChannelData(0);
              var rightIn = inputBuffer.getChannelData(1);
              var leftOut = outputBuffer.getChannelData(0);
              var rightOut = outputBuffer.getChannelData(1);
              for (var i = 0; i < inputBuffer.length; ++i) {
                var rms = leftIn[i] * 0.5 + rightIn[i] * 0.5;
                if (userms) {
                  rms = getRMS(rms);
                }
                var rmsDB = 20.0 * Math.log10(rms);
                var factor = 1;
                if (rmsDB > fxh.previousRms) {
                  factor = -1;
                }
                gain = fxh.previousGain + factor * speed / (fxh.samplerate * 0.5);
                if (rms * gain > 1.0) {
                  gain = 1.0 / rms;
                }
                gain = Math.min(gain, maxgain);
                fxh.previousGain = gain;
                fxh.previousRms = rmsDB;
                leftOut[i] = leftIn[i] * gain;
                rightOut[i] = rightIn[i] * gain;
              }
            };
            input.connect(fx);
            return fx;
          },
      		gain: function(ctx, input, settings) {
      			var fx = ctx.createGain();
      			fx.gain.value = settings.gain;
      			input.connect(fx);
      			return fx;
      		},
      		filter: function(ctx, input, settings) {
      			var fx = ctx.createBiquadFilter();
      			fx.type = settings.type;
      			fx.frequency.value = settings.frequency;
      			fx.Q.value = settings.q;
      			fx.gain.value = settings.gain;
      			input.connect(fx);
      			return fx;
      		},
      		compressor: function(ctx, input, settings) {
      			var fx = ctx.createDynamicsCompressor();
      			fx.attack.value = settings.attack;
      			fx.release.value = settings.release;
      			fx.ratio.value = settings.ratio;
      			fx.threshold.value = settings.threshold;
      			input.connect(fx);
      			return fx;
      		},
      		monoband: function(ctx, input, settings) {
      			var filter = FXs.filter(ctx, input, {
      				type: 'bandpass',
      				frequency: settings.centerFrequency,
      				q: 0.5,
      				gain: 1.0
      			});
      			var compressor = FXs.compressor(ctx, filter, {
      				attack: settings.attack,
      				release: settings.release,
      				ratio: settings.ratio,
      				threshold: settings.threshold
      			});
      			var gain = FXs.gain(ctx, compressor, {
      				gain: settings.gain
      			});
      			return gain;
      		},
      		multiband: function(ctx, input, settings) {
      			var bands = [];
      			var joiner = ctx.createGain();
      			for (var b in settings.bands) {
      				var band = settings.bands[b];
      				var monoband = FXs.monoband(ctx, input, band);
      				monoband.connect(joiner);
      			}
      			return joiner;
      		}
      	};

      	var context = new (AudioContext || webkitAudioContext)();
      	var source = context.createMediaElementSource(audio);
      	var output = context.createGain();

      	var input = source;
      	var chainInput = null;
      	for (var e in data) {
      		var effect = data[e];
      		input = FXs[effect.type](context, input, effect.settings);
      		if (!chainInput) {
      			chainInput = input;
      		}
      	}
      	input.connect(output);
      	output.connect(context.destination);
      	source.connect(chainInput);
      };

      if (typeof params == 'string') {
        $.get(params, function(data){
          var settings = JSON.parse(data);
          processSP(settings);
        });
      } else if (typeof params == 'function') {
        processSP(params());
      } else if (typeof params == 'object') {
        processSP(params);
      } else {
        throw new Exception('jssp could not initialize.');
      }
    });
  };
})(jQuery);
